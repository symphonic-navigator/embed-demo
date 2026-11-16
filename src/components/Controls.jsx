import { SLIDERS } from '../data/suggestions.js'

const HINTS = {
  k: '"Only the top k of each year group get a place." It depends on rank only, not on how good they are.',
  p: '"Admit the best until together they hold p of all the points." A clear winner admits few, a close race admits many.',
  temperature: 'Low: the winner takes almost everything. High: everyone gets nearly the same share. This moves the p line.',
}

function Slider({ name, label, value, format, onChange }) {
  const { min, max, step } = SLIDERS[name]
  return (
    <div className="control">
      <label htmlFor={`slider-${name}`}>
        {label}: <b>{format(value)}</b>
      </label>
      <input
        id={`slider-${name}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="hint">{HINTS[name]}</div>
    </div>
  )
}

export default function Controls({ k, p, temperature, onChange }) {
  return (
    <div className="controls">
      <Slider name="k" label="top-k" value={k} format={String} onChange={(v) => onChange({ k: v })} />
      <Slider name="p" label="top-p" value={p} format={(v) => v.toFixed(2)} onChange={(v) => onChange({ p: v })} />
      <Slider
        name="temperature"
        label="Temperature"
        value={temperature}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange({ temperature: v })}
      />
    </div>
  )
}
