import React, { useEffect, useMemo, useState } from 'react';
import ChipsInput from '../common/ChipsInput';
import {
  MOOD_OPTIONS,
  ACTIVITY_OPTIONS,
  WEATHER_OPTIONS,
  VISIBILITY_OPTIONS,
  WIND_OPTIONS,
  PRECIPITATION_OPTIONS,
  PRIVACY_OPTIONS,
  DIFFICULTY_LABELS,
  QUALITY_LABELS,
} from '../../constants/annotations';
import '../../styles/Annotations.css';

const defaultAnnotations = {
  tags: [],
  mood: '',
  activity: '',
  weather: '',
  difficulty: 3,
  visibility: '',
  temperature: '',
  wind: '',
  precipitation: '',
  companions: [],
  gear: [],
  location_name: '',
  reference_url: '',
  private_notes: '',
  is_first_summit: false,
  is_personal_record: false,
  is_trip_highlight: false,
  is_bucket_list: false,
  quality_rating: 4,
  privacy: 'public',
};

const AnnotationEditorModal = ({
  isOpen,
  photo,
  onClose,
  onSave,
  saving = false,
}) => {
  const [values, setValues] = useState({ ...defaultAnnotations });

  const resolvedPhoto = photo || {};

  useEffect(() => {
    if (!isOpen || !photo) {
      setValues({ ...defaultAnnotations });
      return;
    }
    const source = photo.annotations || {};
    setValues({
      ...defaultAnnotations,
      ...source,
      tags: Array.isArray(source.tags) ? source.tags : [],
      companions: Array.isArray(source.companions) ? source.companions : [],
      gear: Array.isArray(source.gear) ? source.gear : [],
      difficulty: source.difficulty || 3,
      quality_rating: source.quality_rating || 4,
      temperature: source.temperature ?? '',
      private_notes: source.private_notes || '',
      location_name: source.location_name || '',
      reference_url: source.reference_url || '',
      privacy: source.privacy || 'public',
    });
  }, [isOpen, photo]);

  const handleChange = (field, value) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumberChange = (field, value) => {
    if (value === '' || value === null) {
      handleChange(field, '');
    } else {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        handleChange(field, numeric);
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (typeof onSave === 'function') {
      onSave(values);
    }
  };

  const title = resolvedPhoto?.noteTitle || resolvedPhoto?.fileName || 'Photo annotations';

  if (!isOpen || !photo) {
    return null;
  }

  return (
    <div className="annotation-modal-overlay" role="dialog" aria-modal="true">
      <div className="annotation-modal">
        <header className="annotation-modal__header">
          <div>
            <p className="eyebrow">Annotation editor</p>
            <h2>{title}</h2>
            {resolvedPhoto?.capturedDate && (
              <p className="muted">Captured {resolvedPhoto.capturedDate.toLocaleString?.() || resolvedPhoto.capturedAt}</p>
            )}
          </div>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close annotation editor">
            ×
          </button>
        </header>

        <form className="annotation-form" onSubmit={handleSubmit}>
          <section>
            <h3>Tags & Categorization</h3>
            <ChipsInput
              label="Tags"
              values={values.tags}
              onChange={(next) => handleChange('tags', next)}
              placeholder="Add tag and press Enter"
              suggestions={["summit", "scenic", "milestone", "panorama", "meal", "rest-point"]}
            />
          </section>

          <section className="grid two">
            <label>
              Mood
              <select value={values.mood} onChange={(event) => handleChange('mood', event.target.value)}>
                <option value="">Select mood</option>
                {MOOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Activity
              <select value={values.activity} onChange={(event) => handleChange('activity', event.target.value)}>
                <option value="">Select activity</option>
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Weather
              <select value={values.weather} onChange={(event) => handleChange('weather', event.target.value)}>
                <option value="">Select weather</option>
                {WEATHER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Visibility
              <select value={values.visibility} onChange={(event) => handleChange('visibility', event.target.value)}>
                <option value="">Select visibility</option>
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid three">
            <label>
              Temperature (°C)
              <input
                type="number"
                value={values.temperature}
                placeholder="18"
                onChange={(event) => handleNumberChange('temperature', event.target.value)}
              />
            </label>
            <label>
              Wind
              <select value={values.wind} onChange={(event) => handleChange('wind', event.target.value)}>
                <option value="">Select wind</option>
                {WIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Precipitation
              <select value={values.precipitation} onChange={(event) => handleChange('precipitation', event.target.value)}>
                <option value="">Select precipitation</option>
                {PRECIPITATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid two">
            <label>
              Difficulty
              <div className="slider-field">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={values.difficulty}
                  onChange={(event) => handleChange('difficulty', Number(event.target.value))}
                />
                <span>{DIFFICULTY_LABELS[values.difficulty]}</span>
              </div>
            </label>
            <label>
              Photo quality
              <div className="slider-field">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={values.quality_rating}
                  onChange={(event) => handleChange('quality_rating', Number(event.target.value))}
                />
                <span>{QUALITY_LABELS[values.quality_rating]}</span>
              </div>
            </label>
          </section>

          <section className="grid two">
            <ChipsInput
              label="Companions"
              values={values.companions}
              onChange={(next) => handleChange('companions', next)}
              placeholder="Add person"
              suggestions={["Alice", "Bob", "Carol", "David"]}
            />
            <ChipsInput
              label="Gear used"
              values={values.gear}
              onChange={(next) => handleChange('gear', next)}
              placeholder="Add gear"
              suggestions={["camera", "drone", "trekking poles", "backpack"]}
            />
          </section>

          <section className="grid two">
            <label>
              Location name
              <input
                type="text"
                value={values.location_name}
                placeholder="Mt. Jade Main Peak"
                onChange={(event) => handleChange('location_name', event.target.value)}
              />
            </label>
            <label>
              Reference URL
              <input
                type="url"
                value={values.reference_url}
                placeholder="https://en.wikipedia.org/..."
                onChange={(event) => handleChange('reference_url', event.target.value)}
              />
            </label>
          </section>

          <section>
            <label>
              Private notes
              <textarea
                rows={4}
                value={values.private_notes}
                placeholder="Not included in exports"
                onChange={(event) => handleChange('private_notes', event.target.value)}
              />
            </label>
          </section>

          <section className="grid two">
            <div className="achievements">
              <label>
                <input
                  type="checkbox"
                  checked={values.is_first_summit}
                  onChange={(event) => handleChange('is_first_summit', event.target.checked)}
                />
                First summit
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={values.is_personal_record}
                  onChange={(event) => handleChange('is_personal_record', event.target.checked)}
                />
                Personal record
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={values.is_trip_highlight}
                  onChange={(event) => handleChange('is_trip_highlight', event.target.checked)}
                />
                Trip highlight
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={values.is_bucket_list}
                  onChange={(event) => handleChange('is_bucket_list', event.target.checked)}
                />
                Bucket list moment
              </label>
            </div>
            <label>
              Privacy
              <select value={values.privacy} onChange={(event) => handleChange('privacy', event.target.value)}>
                {PRIVACY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </section>

          <footer className="annotation-modal__footer">
            <button type="button" className="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save annotations'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AnnotationEditorModal;
