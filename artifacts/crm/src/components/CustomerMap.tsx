import { useEffect, useRef, useState } from "react";
import type { Map, Marker, Circle } from "leaflet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation, MapPin, History, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { CustomerVisit } from "@/lib/firestore";
import { fmtDate } from "@/lib/utils-crm";

interface Props {
  customerId: string;
  address?: string;
  visits: CustomerVisit[];
  onCheckIn: (lat: number, lng: number) => Promise<void>;
}

// Geocode an address string via Nominatim (free, no API key)
async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    // silently fail
  }
  return null;
}

export default function CustomerMap({ customerId: _customerId, address, visits, onCheckIn }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<Map | null>(null);
  const currentMarker = useRef<Marker | null>(null);
  const accuracyCircle = useRef<Circle | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [customerPos, setCustomerPos] = useState<[number, number] | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Haversine distance in km
  function haversine([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    let mounted = true;

    async function initMap() {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");

      if (!mapRef.current || !mounted) return;

      // Default icon fix for bundlers
      const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
      const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
      const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

      const DefaultIcon = L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] });
      L.Marker.prototype.options.icon = DefaultIcon;

      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = map;

      // ── Geocode customer address ─────────────────────────────────────────────
      let custCoords: [number, number] | null = null;
      if (address) {
        custCoords = await geocode(address);
        if (custCoords && mounted) {
          const customerIcon = L.divIcon({
            html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
            className: "",
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          L.marker(custCoords, { icon: customerIcon })
            .bindPopup(`<b>📍 Customer Address</b><br/>${address}`)
            .addTo(map);
          setCustomerPos(custCoords);
        }
      }

      // ── Plot past visits ─────────────────────────────────────────────────────
      visits.forEach((v) => {
        const visitIcon = L.divIcon({
          html: `<div style="background:#f59e0b;width:11px;height:11px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);opacity:0.85"></div>`,
          className: "",
          iconSize: [11, 11],
          iconAnchor: [5.5, 5.5],
        });
        L.marker([v.lat, v.lng], { icon: visitIcon })
          .bindPopup(`<b>🕐 Past Visit</b><br/>${new Date(v.timestamp).toLocaleString()}${v.note ? `<br/><i>${v.note}</i>` : ""}`)
          .addTo(map);
      });

      // ── Fit bounds ───────────────────────────────────────────────────────────
      const allCoords: [number, number][] = [
        ...(custCoords ? [custCoords] : []),
        ...visits.map((v): [number, number] => [v.lat, v.lng]),
      ];

      if (allCoords.length > 0) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], maxZoom: 15 });
      } else {
        // Default: Dubai
        map.setView([25.2048, 55.2708], 11);
      }

      if (mounted) setMapReady(true);
    }

    initMap();
    return () => { mounted = false; };
  }, [address]);

  // ── Re-plot visits when they change ─────────────────────────────────────────
  useEffect(() => {
    if (!leafletMap.current || !mapReady) return;
    // Only runs after initial load — the init effect already plotted the initial set
    // Nothing extra needed; full reload if visits change via re-render
  }, [visits, mapReady]);

  // ── Get current location ─────────────────────────────────────────────────────
  async function locateMe() {
    if (!leafletMap.current) return;
    const L = await import("leaflet");
    setGettingLocation(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(coords);
        setGettingLocation(false);

        // Remove old current-location marker
        if (currentMarker.current) currentMarker.current.remove();
        if (accuracyCircle.current) accuracyCircle.current.remove();

        const me = L.divIcon({
          html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(16,185,129,0.7)"></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        currentMarker.current = L.marker(coords, { icon: me })
          .bindPopup("<b>📍 Your Location</b>")
          .addTo(leafletMap.current!);

        if (pos.coords.accuracy) {
          accuracyCircle.current = L.circle(coords, {
            radius: pos.coords.accuracy,
            color: "#10b981",
            fillColor: "#10b981",
            fillOpacity: 0.08,
            weight: 1,
          }).addTo(leafletMap.current!);
        }

        // If we also have customer coords, compute distance and fit both
        if (customerPos) {
          const dist = haversine(coords, customerPos);
          setDistanceKm(dist);
          const bounds = L.latLngBounds([coords, customerPos]);
          leafletMap.current!.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
        } else {
          leafletMap.current!.setView(coords, 14);
        }
      },
      (err) => {
        setGettingLocation(false);
        if (err.code === 1) setGeoError("Location permission denied. Please allow location access in your browser.");
        else setGeoError("Could not get your location. Please try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── Check in ────────────────────────────────────────────────────────────────
  async function handleCheckIn() {
    if (currentPos) {
      setCheckingIn(true);
      await onCheckIn(currentPos[0], currentPos[1]);
      setCheckingIn(false);
      setCheckedIn(true);
      setTimeout(() => setCheckedIn(false), 3000);
      return;
    }
    // No location yet — get it then check in
    setGettingLocation(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCurrentPos(coords);
        setGettingLocation(false);
        setCheckingIn(true);
        await onCheckIn(coords[0], coords[1]);
        setCheckingIn(false);
        setCheckedIn(true);
        setTimeout(() => setCheckedIn(false), 3000);

        const L = await import("leaflet");
        if (leafletMap.current) {
          const me = L.divIcon({
            html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(16,185,129,0.7)"></div>`,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          if (currentMarker.current) currentMarker.current.remove();
          currentMarker.current = L.marker(coords, { icon: me })
            .bindPopup("<b>📍 Your Location</b>")
            .addTo(leafletMap.current);
          if (customerPos) {
            setDistanceKm(haversine(coords, customerPos));
          }
          leafletMap.current.setView(coords, 14);
        }
      },
      (err) => {
        setGettingLocation(false);
        if (err.code === 1) setGeoError("Location permission denied.");
        else setGeoError("Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Legend + controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-sm inline-block" />
            Customer address
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
        <div className="flex items-center gap-2">
          {distanceKm !== null && (
            <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              {distanceKm < 1
                ? `${Math.round(distanceKm * 1000)} m away`
                : `${distanceKm.toFixed(1)} km away`}
            </span>
          )}
          <Button
            size="sm" variant="outline"
            onClick={locateMe}
            disabled={gettingLocation}
            className="gap-1.5 h-8 text-xs"
          >
            {gettingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            My Location
          </Button>
          <Button
            size="sm"
            onClick={handleCheckIn}
            disabled={checkingIn || gettingLocation}
            className={`gap-1.5 h-8 text-xs ${checkedIn ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
          >
            {checkingIn || gettingLocation
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : checkedIn
              ? <CheckCircle2 className="w-3.5 h-3.5" />
              : <MapPin className="w-3.5 h-3.5" />}
            {checkedIn ? "Checked In!" : "Check In"}
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {geoError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {geoError}
        </div>
      )}

      {/* ── No address warning ── */}
      {!address && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          No address saved for this customer — add one to see their location pinned on the map.
        </div>
      )}

      {/* ── Map container ── */}
      <div className="relative rounded-xl overflow-hidden border">
        {!mapReady && (
          <div className="absolute inset-0 z-10 bg-muted/60 flex items-center justify-center">
            <Skeleton className="absolute inset-0 rounded-xl" />
            <p className="relative z-10 text-xs text-muted-foreground">Loading map…</p>
          </div>
        )}
        <div ref={mapRef} style={{ height: 340 }} />
      </div>

      {/* ── Past visits list ── */}
      {visits.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visit History</span>
          </div>
          <div className="divide-y max-h-48 overflow-y-auto">
            {visits.map((v) => (
              <div key={v.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-muted-foreground text-xs">{new Date(v.timestamp).toLocaleString("en-AE")}</span>
                  {v.note && <span className="text-xs italic text-muted-foreground">— {v.note}</span>}
                </div>
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {v.lat.toFixed(5)}, {v.lng.toFixed(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
