import { MessageCircle, Phone } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  phones: string[];
  variant?: "icon" | "label";
  className?: string;
}

export default function PhoneActionButtons({ phones, variant = "icon", className = "" }: Props) {
  if (!phones.length) return null;

  function openWa(ph: string) {
    window.open(`https://wa.me/${ph.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer");
  }

  function openCall(ph: string) {
    window.location.href = `tel:${ph}`;
  }

  if (phones.length === 1) {
    const ph = phones[0];
    if (variant === "label") {
      return (
        <span className={`flex items-center gap-1 ${className}`}>
          <button
            type="button"
            onClick={() => openWa(ph)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => openCall(ph)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> Call
          </button>
        </span>
      );
    }
    return (
      <span className={`flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={() => openWa(ph)}
          title={`WhatsApp ${ph}`}
          className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => openCall(ph)}
          title={`Call ${ph}`}
          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Phone className="w-4 h-4" />
        </button>
      </span>
    );
  }

  if (variant === "label") {
    return (
      <span className={`flex items-center gap-1 ${className}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[170px]">
            {phones.map((ph) => (
              <DropdownMenuItem key={ph} onClick={() => openWa(ph)} className="gap-2 cursor-pointer">
                <MessageCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span className="text-sm">{ph}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[170px]">
            {phones.map((ph) => (
              <DropdownMenuItem key={ph} onClick={() => openCall(ph)} className="gap-2 cursor-pointer">
                <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-sm">{ph}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="WhatsApp"
            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[170px]">
          {phones.map((ph) => (
            <DropdownMenuItem key={ph} onClick={() => openWa(ph)} className="gap-2 cursor-pointer">
              <MessageCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span className="text-sm">{ph}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Call"
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Phone className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[170px]">
          {phones.map((ph) => (
            <DropdownMenuItem key={ph} onClick={() => openCall(ph)} className="gap-2 cursor-pointer">
              <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-sm">{ph}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
