"use client";
import { useEffect, useState } from "react";
import { Circle, MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import MapTiles from "./MapTiles";

type Props = {
  lat: number;
  lng: number;
  accuracy: number | null;
  onChange: (lat: number, lng: number) => void;
  minZoom?: number;
  centre?: { lat: number; lng: number } | null;
  readOnly?: boolean;
};

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:30px;line-height:30px;transform:translateY(-15px);filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));cursor:grab">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const gpsIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:30px;line-height:30px;transform:translateY(-15px);filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))">🧍</div>',
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

function FollowView({
  centre,
  minZoom,
}: {
  centre: { lat: number; lng: number };
  minZoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([centre.lat, centre.lng], Math.max(map.getZoom(), minZoom), { animate: true });
  }, [centre.lat, centre.lng, map, minZoom]);
  return null;
}

export default function LocationPicker({
  lat,
  lng,
  accuracy,
  onChange,
  minZoom = 16,
  centre = null,
  readOnly = false,
}: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return <div style={{ height: 300 }} />;

  const view = centre ?? { lat, lng };

  return (
    <MapContainer
      center={[view.lat, view.lng]}
      zoom={minZoom}
      style={{ height: 300, width: "100%" }}
      dragging={!readOnly}
      doubleClickZoom={!readOnly}
      ref={(m) => {
        if (m) setTimeout(() => m.invalidateSize(), 300);
      }}
    >
      <MapTiles />
      {accuracy !== null && (
        <Circle
          center={[lat, lng]}
          radius={accuracy}
          pathOptions={{ color: "#198a00", weight: 1, fillOpacity: 0.12 }}
        />
      )}
      <Marker
        position={[lat, lng]}
        icon={readOnly ? gpsIcon : pinIcon}
        draggable={!readOnly}
        eventHandlers={{
          dragend: (e) => {
            const p = (e.target as L.Marker).getLatLng();
            onChange(p.lat, p.lng);
          },
        }}
      />
      {!readOnly && <ClickCatcher onPick={onChange} />}
      <FollowView centre={view} minZoom={minZoom} />
    </MapContainer>
  );
}
