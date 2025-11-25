import React, { useMemo, useState } from 'react';
import ChipsInput from '../common/ChipsInput';
import {
  MOOD_OPTIONS,
  ACTIVITY_OPTIONS,
  WEATHER_OPTIONS,
  PRIVACY_OPTIONS,
} from '../../constants/annotations';
import '../../styles/Annotations.css';

const buildInitialState = () => ({
  tags: { enabled: false, value: [], mode: 'append' },
  mood: { enabled: false, value: '' },
  activity: { enabled: false, value: '' },
  weather: { enabled: false, value: '' },
  difficulty: { enabled: false, value: 3 },
  companions: { enabled: false, value: [], mode: 'append' },
  gear: { enabled: false, value: [], mode: 'append' },
  privacy: { enabled: false, value: 'public' },
});

const BulkAnnotationModal = ({
  isOpen,
  selectedPhotos = [],
  onClose,
  onApply,
  saving = false,
}) => {
  const [state, setState] = useState(() => buildInitialState());

  const totalSelected = selectedPhotos.length;
  const readyFields = useMemo(() => Object.entries(state).filter(([_, config]) => config.enabled), [state]);
  const canSubmit = readyFields.length > 0 && totalSelected > 0;

  const toggleField = (field) => {
    setState((prev) => ({
      ...prev,
      [field]: { ...prev[field], enabled: !prev[field].enabled },
    }));
  };

  const updateFieldValue = (field, value) => {
    setState((prev) => ({
      ...prev,
      [field]: { ...prev[field], value },
    }));
  };

  const updateFieldMode = (field, mode) => {
    setState((prev) => ({
      ...prev,
      [field]: { ...prev[field], mode },
    }));
  };

  const resetState = () => setState(buildInitialState());

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit || typeof onApply !== 'function') return;

    const annotationsPayload = {};
    let tagMode = 'append';
    let companionMode = 'append';
    let gearMode = 'append';

    Object.entries(state).forEach(([field, cfg]) => {
      if (!cfg.enabled) return;
      if (Array.isArray(cfg.value)) {
        annotationsPayload[field] = cfg.value;
      } else {
        annotationsPayload[field] = cfg.value;
      }
      if (field === 'tags') tagMode = cfg.mode;
      if (field === 'companions') companionMode = cfg.mode;
      if (field === 'gear') gearMode = cfg.mode;
    });

    onApply({
      annotations: annotationsPayload,
      tagMode,
      companionMode,
      gearMode,
    });
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="annotation-modal-overlay">
      <div className="annotation-modal bulk">
        <header className="annotation-modal__header">
          <div>
            <p className="eyebrow">Bulk annotation</p>
            <h2>{totalSelected} photo{totalSelected === 1 ? '' : 's'} selected</h2>
            <p className="muted">Choose which fields to update. Unchecked rows stay untouched.</p>
          </div>
          <button type="button" className="ghost" onClick={handleClose} aria-label="Close bulk annotation">
            ×
          </button>
        </header>

        <form className="annotation-form" onSubmit={handleSubmit}>
          <section>
            <div className="bulk-row">
              <label>
                <input type="checkbox" checked={state.tags.enabled} onChange={() => toggleField('tags')} />
                Tags
              </label>
              <div className="bulk-row__controls">
                <label className="radio">
                  <input
                    type="radio"
                    name="tags-mode"
                    value="append"
                    checked={state.tags.mode === 'append'}
                    disabled={!state.tags.enabled}
                    onChange={(event) => updateFieldMode('tags', event.target.value)}
                  />
                  Append
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="tags-mode"
                    value="replace"
                    checked={state.tags.mode === 'replace'}
                    disabled={!state.tags.enabled}
                    onChange={(event) => updateFieldMode('tags', event.target.value)}
                  />
                  Replace
                </label>
              </div>
            </div>
            <ChipsInput
              values={state.tags.value}
              onChange={(next) => updateFieldValue('tags', next)}
              placeholder="Add tags to apply"
              suggestions={["summit", "day-1", "highlight"]}
              disabled={!state.tags.enabled}
            />
          </section>

          <section className="grid three">
            <label className={`bulk-toggle ${!state.mood.enabled ? 'disabled' : ''}`}>
              <input type="checkbox" checked={state.mood.enabled} onChange={() => toggleField('mood')} />
              <span>Mood</span>
              <select
                value={state.mood.value}
                disabled={!state.mood.enabled}
                onChange={(event) => updateFieldValue('mood', event.target.value)}
              >
                <option value="">Select mood</option>
                {MOOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={`bulk-toggle ${!state.activity.enabled ? 'disabled' : ''}`}>
              <input type="checkbox" checked={state.activity.enabled} onChange={() => toggleField('activity')} />
              <span>Activity</span>
              <select
                value={state.activity.value}
                disabled={!state.activity.enabled}
                onChange={(event) => updateFieldValue('activity', event.target.value)}
              >
                <option value="">Select activity</option>
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className={`bulk-toggle ${!state.weather.enabled ? 'disabled' : ''}`}>
              <input type="checkbox" checked={state.weather.enabled} onChange={() => toggleField('weather')} />
              <span>Weather</span>
              <select
                value={state.weather.value}
                disabled={!state.weather.enabled}
                onChange={(event) => updateFieldValue('weather', event.target.value)}
              >
                <option value="">Select weather</option>
                {WEATHER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section>
            <label className={`bulk-toggle ${!state.difficulty.enabled ? 'disabled' : ''}`}>
              <input type="checkbox" checked={state.difficulty.enabled} onChange={() => toggleField('difficulty')} />
              <span>Difficulty</span>
              <input
                type="range"
                min="1"
                max="5"
                value={state.difficulty.value}
                disabled={!state.difficulty.enabled}
                onChange={(event) => updateFieldValue('difficulty', Number(event.target.value))}
              />
            </label>
          </section>

          <section>
            <div className="bulk-row">
              <label>
                <input type="checkbox" checked={state.companions.enabled} onChange={() => toggleField('companions')} />
                Companions
              </label>
              <div className="bulk-row__controls">
                <label className="radio">
                  <input
                    type="radio"
                    name="companions-mode"
                    value="append"
                    checked={state.companions.mode === 'append'}
                    disabled={!state.companions.enabled}
                    onChange={(event) => updateFieldMode('companions', event.target.value)}
                  />
                  Append
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="companions-mode"
                    value="replace"
                    checked={state.companions.mode === 'replace'}
                    disabled={!state.companions.enabled}
                    onChange={(event) => updateFieldMode('companions', event.target.value)}
                  />
                  Replace
                </label>
              </div>
            </div>
            <ChipsInput
              values={state.companions.value}
              onChange={(next) => updateFieldValue('companions', next)}
              placeholder="Add names"
              disabled={!state.companions.enabled}
            />
          </section>

          <section>
            <div className="bulk-row">
              <label>
                <input type="checkbox" checked={state.gear.enabled} onChange={() => toggleField('gear')} />
                Gear
              </label>
              <div className="bulk-row__controls">
                <label className="radio">
                  <input
                    type="radio"
                    name="gear-mode"
                    value="append"
                    checked={state.gear.mode === 'append'}
                    disabled={!state.gear.enabled}
                    onChange={(event) => updateFieldMode('gear', event.target.value)}
                  />
                  Append
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    name="gear-mode"
                    value="replace"
                    checked={state.gear.mode === 'replace'}
                    disabled={!state.gear.enabled}
                    onChange={(event) => updateFieldMode('gear', event.target.value)}
                  />
                  Replace
                </label>
              </div>
            </div>
            <ChipsInput
              values={state.gear.value}
              onChange={(next) => updateFieldValue('gear', next)}
              placeholder="Add gear"
              disabled={!state.gear.enabled}
            />
          </section>

          <section>
            <label className={`bulk-toggle ${!state.privacy.enabled ? 'disabled' : ''}`}>
              <input type="checkbox" checked={state.privacy.enabled} onChange={() => toggleField('privacy')} />
              <span>Privacy</span>
              <select
                value={state.privacy.value}
                disabled={!state.privacy.enabled}
                onChange={(event) => updateFieldValue('privacy', event.target.value)}
              >
                {PRIVACY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <footer className="annotation-modal__footer">
            <button type="button" className="ghost" onClick={handleClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!canSubmit || saving}>
              {saving ? 'Applying…' : `Apply to ${totalSelected} photos`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default BulkAnnotationModal;
