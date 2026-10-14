"use client";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapTiles from "./MapTiles";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

export const compoundIcon = (name: string) =>
  L.divIcon({
    className: "",
    html: `<div style="pointer-events:none;position:absolute;left:-45px;top:-14px;width:90px;text-align:center">` +
      `<div style="font-size:16px;line-height:16px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">🗺️</div>` +
      `<div style="display:inline-block;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;line-height:11px;font-weight:700;color:#0f3d1f;background:rgba(255,255,255,.9);border-radius:4px;padding:0 3px">${esc(
        name
      )}</div>` +
      `</div>`,
    iconSize: [0, 0],
  });

function FollowCentre({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

type Props = { lat: number; lng: number; name: string };

export default function CompoundPreview({ lat, lng, name }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return <div style={{ height: 220 }} className="bg-gray-100" />;

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: 220, width: "100%" }}
      ref={(m) => {
        if (m) setTimeout(() => m.invalidateSize(), 200);
      }}
    >
      <MapTiles />
      <CircleMarker
        center={[lat, lng]}
        radius={8}
        pathOptions={{ color: "#198a00", fillColor: "#198a00", fillOpacity: 0.9 }}
      />
      <Marker position={[lat, lng]} icon={compoundIcon(name)}>
        <Popup>
          {name} compound centre
        </Popup>
      </Marker>
      <FollowCentre lat={lat} lng={lng} zoom={15} />
    </MapContainer>
  );
}
