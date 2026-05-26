import { useEffect, useRef, useState } from "react";
import type { Map, Marker, Circle } from "leaflet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Navigation, MapPin, History, CheckCircle2, Loader2,
  AlertTriangle, Save, ExternalLink,
} from "lucide-react";
import { CustomerVisit } from "@/lib/firestore";

interface Props {
  customerId: string;
  address?: string;
  savedLat?: number;
  savedLng?: number;
  visits: CustomerVisit[];
  onCheckIn: (lat: number, lng: number) => Promise<void>;
  onSaveLocation: (lat: number, lng: number) => Promise<void>;
}

async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* silent */ }
  return null;
}

function haversine([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CustomerMap({
  address, savedLat, savedLng, visits, onCheckIn, onSaveLocation,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<Map | null>(null);
  const currentMarker = useRef<Marker | null>(null);
  const accuracyCircle = useRef<Circle | null>(null);
  const savedMarker = useRef<Marker | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [customerPos, setCustomerPos] = useState<[number, number] | null>(null);
  const [pinnedPos, setPinnedPos] = useState<[number, number] | null>(
    savedLat != null && savedLng != null ? [savedLat, savedLng] : null
  );
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);

  // ── Build navigate URL ───────────────────────────────────────────────────
  function getNavigateUrl() {
    if (pinnedPos) {
      return `https://www.google.com/maps/dir/?api=1&destination=${pinnedPos[0]},${pinnedPos[1]}&travelmode=driving`;
    }
    if (customerPos) {
      return `https://www.google.com/maps/dir/?api=1&destination=${customerPos[0]},${customerPos[1]}&travelmode=driving`;
    }
    if (address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
    }
    return null;
  }

  // ── Draw saved-location pin ──────────────────────────────────────────────
  async function drawSavedPin(lat: number, lng: number) {
    if (!leafletMap.current) return;
    const L = await import("leaflet");
    if (savedMarker.current) savedMarker.current.remove();
    const icon = L.divIcon({
      html: `<div style="background:#7c3aed;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(124,58,237,0.5)"></div>`,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    savedMarker.current = L.marker([lat, lng], { icon })
      .bindPopup("<b>📌 Saved Location</b><br/>Pinned to this customer's profile")
      .addTo(leafletMap.current);
  }

  // ── Init Leaflet map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    let mounted = true;

    async function initMap() {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (!mapRef.current || !mounted) return;

      const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
      const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
      const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
      L.Marker.prototype.options.icon = L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });

      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      leafletMap.current = map;

      const allCoords: [number, number][] = [];

      // Saved GPS location (purple pin — highest priority)
      if (savedLat != null && savedLng != null) {
        const icon = L.divIcon({
          html: `<div style="background:#7c3aed;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(124,58,237,0.5)"></div>`,
          className: "", iconSize: [18, 18], iconAnchor: [9, 9],
        });
        L.marker([savedLat, savedLng], { icon })
          .bindPopup("<b>📌 Saved Location</b><br/>Pinned to this customer's profile")
          .addTo(map);
        savedMarker.current = L.marker([savedLat, savedLng], { icon }).addTo(map);
        allCoords.push([savedLat, savedLng]);
      }

      // Geocoded address (blue pin)
      if (address) {
        const coords = await geocode(address);
        if (coords && mounted) {
          const icon = L.divIcon({
            html: `<div style="background:#2563eb;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
            className: "", iconSize: [14, 14], iconAnchor: [7, 7],
          });
          L.marker(coords, { icon })
            .bindPopup(`<b>🏢 Address</b><br/>${address}`)
            .addTo(map);
          setCustomerPos(coords);
          allCoords.push(coords);
        }
      }

      // Past visits (amber)
      visits.forEach((v) => {
        const icon = L.divIcon({
          html: `<div style="background:#f59e0b;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:0.85"></div>`,
          className: "", iconSize: [10, 10], iconAnchor: [5, 5],
        });
        L.marker([v.lat, v.lng], { icon })
          .bindPopup(`<b>🕐 Visit</b><br/>${new Date(v.timestamp).toLocaleString()}`)
          .addTo(map);
        allCoords.push([v.lat, v.lng]);
      });

      if (allCoords.length > 1) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50], maxZoom: 15 });
      } else if (allCoords.length === 1) {
        map.setView(allCoords[0], 14);
      } else {
        map.setView([25.2048, 55.2708], 11); // Dubai default
      }

      if (mounted) setMapReady(true);
    }

    initMap();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Get current GPS ──────────────────────────────────────────────────────
  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 12000,
      });
    });
  }

  async function plotMyLocation(coords: [number, number], accuracy?: number) {
    if (!leafletMap.current) return;
    const L = await import("leaflet");
    if (currentMarker.current) currentMarker.current.remove();
    if (accuracyCircle.current) accuracyCircle.current.remove();

    const icon = L.divIcon({
      html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(16,185,129,0.7)"></div>`,
      className: "", iconSize: [14, 14], iconAnchor: [7, 7],
    });
    currentMarker.current = L.marker(coords, { icon })
      .bindPopup("<b>📍 Your Location</b>")
      .addTo(leafletMap.current);
    if (accuracy) {
      accuracyCircle.current = L.circle(coords, {
        radius: accuracy, color: "#10b981", fillColor: "#10b981", fillOpacity: 0.07, weight: 1,
      }).addTo(leafletMap.current);
    }
  }

  async function locateMe() {
    setGettingLocation(true);
    setGeoError(null);
    try {
      const pos = await getCurrentPosition();
      const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setCurrentPos(coords);
      await plotMyLocation(coords, pos.coords.accuracy);

      const target = pinnedPos || customerPos;
      if (target) {
        setDistanceKm(haversine(coords, target));
        const L = await import("leaflet");
        leafletMap.current?.fitBounds(L.latLngBounds([coords, target]), { padding: [60, 60], maxZoom: 15 });
      } else {
        leafletMap.current?.setView(coords, 14);
      }
    } catch (err: unknown) {
      const code = (err as GeolocationPositionError)?.code;
      setGeoError(code === 1
        ? "Location permission denied. Allow access in your browser settings."
        : "Could not get your location. Please try again.");
    } finally {
      setGettingLocation(false);
    }
  }

  // ── Save Location to profile ─────────────────────────────────────────────
  async function handleSaveLocation() {
    setSavingLocation(true);
    setGeoError(null);
    try {
      let coords: [number, number];
      if (currentPos) {
        coords = currentPos;
      } else {
        setGettingLocation(true);
        const pos = await getCurrentPosition();
        coords = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(coords);
        await plotMyLocation(coords, pos.coords.accuracy);
        setGettingLocation(false);
      }
      await onSaveLocation(coords[0], coords[1]);
      setPinnedPos(coords);
      await drawSavedPin(coords[0], coords[1]);

      // Recalculate distance
      const target = customerPos;
      if (target) setDistanceKm(haversine(coords, target));

      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 3500);

      // Pan to saved location
      leafletMap.current?.setView(coords, 15);
    } catch (err: unknown) {
      setGettingLocation(false);
      const code = (err as GeolocationPositionError)?.code;
      if (code === 1) {
        setGeoError("Location permission denied.");
      } else {
        const fsCode = (err as { code?: string })?.code;
        if (fsCode === "permission-denied") {
          setGeoError("Firestore permission denied — fix your security rules.");
        } else {
          setGeoError("Could not save location. Please try again.");
        }
      }
    } finally {
      setSavingLocation(false);
    }
  }

  // ── Check In ─────────────────────────────────────────────────────────────
  async function handleCheckIn() {
    setCheckingIn(true);
    setGeoError(null);
    try {
      let coords: [number, number];
      if (currentPos) {
        coords = currentPos;
      } else {
        setGettingLocation(true);
        const pos = await getCurrentPosition();
        coords = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(coords);
        await plotMyLocation(coords, pos.coords.accuracy);
        setGettingLocation(false);
      }
      await onCheckIn(coords[0], coords[1]);
      setCheckedIn(true);
      setTimeout(() => setCheckedIn(false), 3000);
    } catch (err: unknown) {
      setGettingLocation(false);
      const geoCode = (err as GeolocationPositionError)?.code;
      setGeoError(geoCode === 1 ? "Location permission denied." : "Could not record visit.");
    } finally {
      setCheckingIn(false);
    }
  }

  const navigateUrl = getNavigateUrl();
  const hasLocation = pinnedPos || customerPos || address;

  return (
    <div className="space-y-3">

      {/* ── Top action row ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Navigate button — primary CTA */}
        {hasLocation ? (
          <a
            href={navigateUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5" />
            Navigate
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground cursor-not-allowed">
            <Navigation className="w-3.5 h-3.5" />
            Navigate
          </span>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {distanceKm !== null && (
            <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m away` : `${distanceKm.toFixed(1)} km away`}
            </span>
          )}

          {/* My Location */}
          <Button size="sm" variant="outline" onClick={locateMe} disabled={gettingLocation || savingLocation} className="gap-1.5 h-8 text-xs">
            {gettingLocation && !savingLocation && !checkingIn
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Navigation className="w-3.5 h-3.5" />}
            My Location
          </Button>

          {/* Save Location */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveLocation}
            disabled={savingLocation || gettingLocation}
            className={`gap-1.5 h-8 text-xs ${locationSaved ? "border-purple-400 text-purple-700 bg-purple-50" : "border-purple-200 text-purple-700 hover:bg-purple-50"}`}
          >
            {savingLocation
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : locationSaved
              ? <CheckCircle2 className="w-3.5 h-3.5" />
              : <Save className="w-3.5 h-3.5" />}
            {locationSaved ? "Location Saved!" : "Save Location"}
          </Button>

          {/* Check In */}
          <Button
            size="sm"
            onClick={handleCheckIn}
            disabled={checkingIn || gettingLocation || savingLocation}
            className={`gap-1.5 h-8 text-xs ${checkedIn ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
          >
            {checkingIn
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : checkedIn
              ? <CheckCircle2 className="w-3.5 h-3.5" />
              : <MapPin className="w-3.5 h-3.5" />}
            {checkedIn ? "Checked In!" : "Check In"}
          </Button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-purple-600 border border-white shadow-sm inline-block" />
          Saved location
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-sm inline-block" />
          Address pin
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm inline-block" />
          Your location
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400 border border-white shadow-sm inline-block" />
          Past visits ({visits.length})
        </span>
      </div>

      {/* ── Error / info banners ── */}
      {geoError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {geoError}
        </div>
      )}
      {!address && !pinnedPos && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          No location saved yet — tap <strong className="mx-1">Save Location</strong> to pin your current GPS to this customer, or add an address.
        </div>
      )}
      {pinnedPos && (
        <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-purple-600" />
          <span>GPS location saved: <span className="font-mono">{pinnedPos[0].toFixed(5)}, {pinnedPos[1].toFixed(5)}</span> — <strong>Navigate</strong> will use this.</span>
        </div>
      )}

      {/* ── Map ── */}
      <div className="relative rounded-xl overflow-hidden border shadow-sm">
        {!mapReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Skeleton className="absolute inset-0 rounded-xl" />
            <p className="relative z-10 text-xs text-muted-foreground">Loading map…</p>
          </div>
        )}
        <div ref={mapRef} style={{ height: 360 }} />
      </div>

      {/* ── Visit history ── */}
      {visits.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visit History</span>
            <span className="ml-auto text-xs text-muted-foreground">{visits.length} total</span>
          </div>
          <div className="divide-y max-h-52 overflow-y-auto">
            {visits.map((v) => (
              <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-xs text-muted-foreground">{new Date(v.timestamp).toLocaleString("en-AE")}</span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-mono tabular-nums"
                  title="Open in Google Maps"
                >
                  {v.lat.toFixed(5)}, {v.lng.toFixed(5)} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
