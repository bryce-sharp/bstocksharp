"use client";

import { BINDING } from "./quilt";
import { SCRIPT, Slider, StitchedModal } from "./parts";
import { GAME_SONG, applySoundSettings, sampleEffects, saveSoundSettings, type SoundSettings } from "./sounds";

function Toggle({ title, about, on, onToggle }: { title: string; about: string; on: boolean; onToggle: (on: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
      <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} style={{ accentColor: BINDING, width: 18, height: 18, margin: "2px 0 0" }} />
      <span>
        <span style={{ display: "block", fontWeight: 600, fontSize: 16 }}>{title}</span>
        <span style={{ display: "block", fontSize: 13, opacity: 0.75 }}>{about}</span>
      </span>
    </label>
  );
}

/** Music and sound effects on or off, each with its own volume; saved on this device. */
export function SoundCard({ settings, onChange, onClose, touch }: { settings: SoundSettings; onChange: (s: SoundSettings) => void; onClose: () => void; touch: boolean }) {
  const change = (next: SoundSettings, sample = false) => {
    onChange(next);
    saveSoundSettings(next);
    applySoundSettings(next);
    if (sample && next.effects) sampleEffects();
  };
  return (
    <StitchedModal label="Sound" onClose={onClose} width={380}>
      <div style={{ fontFamily: SCRIPT, fontSize: 44, lineHeight: 1, color: BINDING, fontWeight: 700, textAlign: "center" }}>Sound</div>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <Toggle title="Music" about={`${GAME_SONG.name}, a cozy loop to sew by.`} on={settings.music} onToggle={(music) => change({ ...settings, music })} />
        <div style={{ paddingLeft: 28 }}>
          <Slider label="Volume" value={settings.musicVolume} disabled={!settings.music} onChange={(musicVolume) => change({ ...settings, musicVolume })} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <Toggle title="Sound effects" about="Soft taps and stitches as you sew." on={settings.effects} onToggle={(effects) => change({ ...settings, effects }, true)} />
        <div style={{ paddingLeft: 28 }}>
          <Slider label="Volume" value={settings.effectsVolume} disabled={!settings.effects} onChange={(effectsVolume) => change({ ...settings, effectsVolume }, true)} />
        </div>
      </div>
      {touch && <p style={{ fontSize: 13, opacity: 0.7, margin: "18px 0 0" }}>On an iPhone, sound plays only with the ringer switch on.</p>}
    </StitchedModal>
  );
}
