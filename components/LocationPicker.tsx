"use client";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lng: number;
  accuracy: number | null;
  onChange: (lat: number, lng: number) => void;
};

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:30px;line-height:30px;transform:translateY(-15px);filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));cursor:grab">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FollowPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function LocationPicker({ lat, lng, accuracy, onChange }: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return <div style={{ height: 300 }} />;

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      style={{ height: 300, width: "100%" }}
      ref={(m) => {
        if (m) setTimeout(() => m.invalidateSize(), 300);
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {accuracy !== null && (
        <Circle
          center={[lat, lng]}
          radius={accuracy}
          pathOptions={{ color: "#198a00", weight: 1, fillOpacity: 0.12 }}
        />
      )}
      <Marker
        position={[lat, lng]}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const p = (e.target as L.Marker).getLatLng();
            onChange(p.lat, p.lng);
          },
        }}
      />
      <ClickCatcher onPick={onChange} />
      <FollowPin lat={lat} lng={lng} />
    </MapContainer>
  );
}
