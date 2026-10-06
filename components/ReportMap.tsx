"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const colors = ["", "#22c55e", "#84cc16", "#eab308", "#f97316", "#dc2626"];

function FixSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const t1 = setTimeout(fix, 200);
    const t2 = setTimeout(fix, 800);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

export default function ReportMap({ reports }: { reports: any[] }) {
  const center: [number, number] = reports.length
    ? [reports[0].lat, reports[0].lng]
    : [-14.4469, 28.4464];

  return (
    <MapContainer center={center} zoom={14} style={{ height: 450, width: "100%" }}>
      <FixSize />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {reports.map((r) => (
        <CircleMarker
          key={r.id}
          center={[r.lat, r.lng]}
          radius={8 + r.severity * 2}
          pathOptions={{ color: colors[r.severity], fillOpacity: 0.7 }}
        >
          <Popup>
            <b>{r.category}</b> (severity {r.severity}/5)
            <br />
            {r.reason}
            <br />
            <img src={r.photo_url} width={150} alt="" />
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}