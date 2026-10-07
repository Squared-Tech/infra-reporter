"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const colors = ["", "#22c55e", "#84cc16", "#eab308", "#f97316", "#dc2626"];

export default function ReportMap({ reports }: { reports: any[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return <div style={{ height: 450 }} />;

  const center: [number, number] = reports.length
    ? [reports[0].lat, reports[0].lng]
    : [-14.4469, 28.4464];

  return (
    <MapContainer
      key={reports[0]?.id ?? "empty"}
      center={center}
      zoom={14}
      style={{ height: 450, width: "100%" }}
      ref={(m) => {
        if (m) setTimeout(() => m.invalidateSize(), 300);
      }}
    >
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
            <small>
              🛡️ Location confidence:{" "}
              <b>
                {r.location_confidence ?? "n/a"}
                {r.location_score != null && ` (${r.location_score}/100)`}
              </b>
            </small>
            <br />
            <small>
              {r.address ?? "Address unavailable"}
              {r.accuracy_m != null && ` · ±${r.accuracy_m} m`}
              {r.location_source && ` · source: ${r.location_source}`}
            </small>
            <br />
            <small>
              {r.photo_distance_m == null
                ? "No photo location to check"
                : r.photo_distance_m <= 50
                ? "✅ Photo location verified"
                : `⚠️ Photo was taken ${r.photo_distance_m} m away`}
            </small>
            <br />
            <img src={r.photo_url} width={150} alt="" />
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}