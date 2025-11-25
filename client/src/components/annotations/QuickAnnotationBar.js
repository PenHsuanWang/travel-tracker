import React, { useEffect, useMemo, useState } from 'react';
import {
  MOOD_OPTIONS,
  ACTIVITY_OPTIONS,
  WEATHER_OPTIONS,
  DIFFICULTY_LABELS,
} from '../../constants/annotations';
import '../../styles/Annotations.css';

const QuickAnnotationBar = ({
  photo,
  onQuickAnnotate,
  onOpenFullEditor,
  saving = false,
}) => {
  const moodOptions = useMemo(() => [{ value: '', label: '— Mood —' }, ...MOOD_OPTIONS], []);
  const activityOptions = useMemo(() => [{ value: '', label: '— Activity —' }, ...ACTIVITY_OPTIONS], []);
  const weatherOptions = useMemo(() => [{ value: '', label: '— Weather —' }, ...WEATHER_OPTIONS], []);

  const buildSnapshot = () => {
    const annotations = photo?.annotations || {};
    return {
      mood: annotations.mood || '',
      activity: annotations.activity || '',
      weather: annotations.weather || '',
      difficulty: annotations.difficulty || 2,
      tags: [...(annotations.tags || [])],
    };
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState(buildSnapshot);
  const [lastSaved, setLastSaved] = useState(buildSnapshot);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    const snapshot = buildSnapshot();
    setDraft(snapshot);
    setLastSaved(snapshot);
    setTagInput('');
    setIsExpanded(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, JSON.stringify(photo?.annotations || {})]);

  if (!photo) {
    return null;
  }

  const editorId = `annotation-editor-${photo.id || photo.metadataId || 'unknown'}`;

  const updateDraft = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addTag = () => {
    const next = tagInput.trim();
    if (!next) return;
    setDraft((prev) => {
      if (prev.tags.includes(next)) {
        return prev;
      }
      return { ...prev, tags: [...prev.tags, next] };
    });
    setTagInput('');
  };

  const removeTag = (tag) => {
    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.filter((existing) => existing !== tag),
    }));
  };

  const handleSave = () => {
    if (saving) return;
    const payload = {
      mood: draft.mood || null,
      activity: draft.activity || null,
      weather: draft.weather || null,
      difficulty: draft.difficulty || null,
      tags: draft.tags,
    };
    if (typeof onQuickAnnotate === 'function') {
      onQuickAnnotate(photo, payload);
    }
    setLastSaved({ ...draft, tags: [...draft.tags] });
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setDraft({ ...lastSaved, tags: [...lastSaved.tags] });
    setTagInput('');
    setIsExpanded(false);
  };

  const getOptionLabel = (options, value, fallback) => {
    const match = options.find((option) => option.value === value);
    return match ? match.label : fallback;
  };

  const displayMood = getOptionLabel(moodOptions, lastSaved.mood, 'Mood —');
  const displayWeather = getOptionLabel(weatherOptions, lastSaved.weather, 'Weather —');
  const difficultyStars = (value) => {
    const level = value || 0;
    const filled = '★'.repeat(level || 0);
    const empty = '☆'.repeat(Math.max(5 - level, 0));
    return `${filled}${empty}` || '☆☆☆☆☆';
  };

  const difficultyLabel = lastSaved.difficulty
    ? DIFFICULTY_LABELS[lastSaved.difficulty] || 'Moderate'
    : 'Set difficulty';

  const collapsedTags = lastSaved.tags.length > 0
    ? [...lastSaved.tags, '+ Add tag']
    : ['+ Add tag'];

  const handleTagInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }
  };

  return (
    <div className="quick-annotation-bar" aria-live="polite">
      <div className="collapsed-tag-bar" aria-label="Annotation summary">
        <div className="collapsed-chip-row">
          <span className="collapsed-chip" data-field="mood" aria-label={`Mood ${displayMood}`}>
            {displayMood}
          </span>
          <span className="collapsed-chip" data-field="weather" aria-label={`Weather ${displayWeather}`}>
            {displayWeather}
          </span>
          <span className="collapsed-chip" data-field="difficulty" aria-label={`Difficulty ${difficultyLabel}`}>
            Difficulty: <span>{difficultyStars(lastSaved.difficulty)}</span>
          </span>
          {collapsedTags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className={`collapsed-chip ${tag === '+ Add tag' ? 'placeholder' : ''}`}
              aria-label={tag === '+ Add tag' ? 'Add tag placeholder' : `Tag ${tag}`}
            >
              {tag}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="expand-editor-btn"
          aria-controls={editorId}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <form
        id={editorId}
        className={`quick-annotation-editor ${isExpanded ? 'visible' : ''}`}
        aria-hidden={!isExpanded}
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <div className="quick-annotation-editor-grid">
          <label className="editor-field" htmlFor={`${editorId}-mood`}>
            <span>Mood</span>
            <select
              id={`${editorId}-mood`}
              value={draft.mood}
              disabled={saving}
              onChange={(event) => updateDraft('mood', event.target.value)}
            >
              {moodOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="editor-field" htmlFor={`${editorId}-weather`}>
            <span>Weather</span>
            <select
              id={`${editorId}-weather`}
              value={draft.weather}
              disabled={saving}
              onChange={(event) => updateDraft('weather', event.target.value)}
            >
              {weatherOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="editor-field" htmlFor={`${editorId}-activity`}>
            <span>Activity</span>
            <select
              id={`${editorId}-activity`}
              value={draft.activity}
              disabled={saving}
              onChange={(event) => updateDraft('activity', event.target.value)}
            >
              {activityOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="editor-field difficulty-field">
            <label htmlFor={`${editorId}-difficulty`}>
              Difficulty
              <span className="range-value">{DIFFICULTY_LABELS[draft.difficulty] || 'Moderate'}</span>
            </label>
            <input
              id={`${editorId}-difficulty`}
              type="range"
              min="1"
              max="5"
              value={draft.difficulty}
              disabled={saving}
              onChange={(event) => updateDraft('difficulty', Number(event.target.value))}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={draft.difficulty}
              aria-label="Difficulty"
            />
          </div>

          <div className="editor-field tag-field">
            <span>Tags</span>
            <div className="tag-chip-row" aria-label="Current tags">
              {draft.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => removeTag(tag)}
                    disabled={saving}
                  >
                    ×
                  </button>
                </span>
              ))}
              {draft.tags.length === 0 && <span className="placeholder">No tags yet</span>}
            </div>
            <div className="tag-input-row">
              <input
                type="text"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="New tag"
                aria-label="New tag"
                disabled={saving}
              />
              <button
                type="button"
                className="secondary"
                onClick={addTag}
                disabled={saving}
              >
                + Add tag
              </button>
            </div>
          </div>
        </div>

        <div className="quick-annotation-actions">
          <button type="button" className="ghost" onClick={() => onOpenFullEditor(photo)}>
            ✏️ Full annotation editor
          </button>
          <div className="action-buttons">
            <button type="button" className="secondary" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default QuickAnnotationBar;
