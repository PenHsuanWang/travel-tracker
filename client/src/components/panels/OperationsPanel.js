// client/src/components/panels/OperationsPanel.js
/**
 * OperationsPanel - Left Sidebar tabbed panel for plan configuration.
 * 
 * Phase 2 Implementation (Zone A):
 * - Tab 1: Team & Logistics (FR-D01, FR-D02)
 * - Tab 2: Gear Checklist (FR-D03)
 * - Tab 3: Settings (Plan metadata)
 * 
 * This component manages the "input" state for trip planning.
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import './OperationsPanel.css';

// Tab identifiers
const TABS = {
  TEAM: 'team',
  GEAR: 'gear',
  SETTINGS: 'settings',
};

// Tab configuration
const TAB_CONFIG = [
  { id: TABS.TEAM, label: 'Team', icon: '👥' },
  { id: TABS.GEAR, label: 'Gear', icon: '🎒' },
  { id: TABS.SETTINGS, label: 'Settings', icon: '⚙️' },
];

/**
 * RosterForm - Form for managing team roster (FR-D01)
 */
const RosterForm = ({ roster = [], onUpdate, readOnly }) => {
  const [editingId, setEditingId] = useState(null);
  const [newMember, setNewMember] = useState({ name: '', role: '', phone: '', emergency_contact: '' });

  const handleAddMember = () => {
    if (!newMember.name.trim()) return;
    
    const member = {
      id: `member-${Date.now()}`,
      name: newMember.name.trim(),
      role: newMember.role.trim() || null,
      phone: newMember.phone.trim() || null,
      emergency_contact: newMember.emergency_contact.trim() || null,
    };
    
    onUpdate([...roster, member]);
    setNewMember({ name: '', role: '', phone: '', emergency_contact: '' });
  };

  const handleRemoveMember = (memberId) => {
    onUpdate(roster.filter(m => m.id !== memberId));
  };

  const handleUpdateMember = (memberId, updates) => {
    onUpdate(roster.map(m => m.id === memberId ? { ...m, ...updates } : m));
    setEditingId(null);
  };

  return (
    <div className="roster-form">
      <h4 className="form-section-title">Team Roster</h4>
      
      {/* Existing members */}
      <div className="roster-list">
        {roster.map((member) => (
          <div key={member.id} className="roster-item">
            {editingId === member.id ? (
              <div className="roster-item-edit">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => handleUpdateMember(member.id, { name: e.target.value })}
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={member.role || ''}
                  onChange={(e) => handleUpdateMember(member.id, { role: e.target.value })}
                  placeholder="Role"
                />
                <button onClick={() => setEditingId(null)}>Done</button>
              </div>
            ) : (
              <>
                <div className="roster-item-info">
                  <span className="roster-name">{member.name}</span>
                  {member.role && <span className="roster-role">{member.role}</span>}
                  {member.phone && <span className="roster-phone">📞 {member.phone}</span>}
                </div>
                {!readOnly && (
                  <div className="roster-item-actions">
                    <button onClick={() => setEditingId(member.id)} title="Edit">✏️</button>
                    <button onClick={() => handleRemoveMember(member.id)} title="Remove">🗑️</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      
      {/* Add new member */}
      {!readOnly && (
        <div className="roster-add-form">
          <input
            type="text"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            placeholder="Name *"
            className="input-name"
          />
          <input
            type="text"
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
            placeholder="Role"
            className="input-role"
          />
          <input
            type="text"
            value={newMember.phone}
            onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
            placeholder="Phone"
            className="input-phone"
          />
          <input
            type="text"
            value={newMember.emergency_contact}
            onChange={(e) => setNewMember({ ...newMember, emergency_contact: e.target.value })}
            placeholder="Emergency Contact"
            className="input-emergency"
          />
          <button 
            onClick={handleAddMember} 
            disabled={!newMember.name.trim()}
            className="btn-add-member"
          >
            + Add Member
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * LogisticsForm - Form for logistics info (FR-D02)
 */
const LogisticsForm = ({ logistics = {}, onUpdate, readOnly }) => {
  const handleChange = (field, value) => {
    onUpdate({ ...logistics, [field]: value });
  };

  return (
    <div className="logistics-form">
      <h4 className="form-section-title">Logistics & Transport</h4>
      
      <div className="form-group">
        <label>Transport Provider</label>
        <input
          type="text"
          value={logistics.transport_provider || ''}
          onChange={(e) => handleChange('transport_provider', e.target.value)}
          placeholder="Shuttle company, taxi service..."
          disabled={readOnly}
        />
      </div>
      
      <div className="form-group">
        <label>Driver Phone</label>
        <input
          type="text"
          value={logistics.driver_phone || ''}
          onChange={(e) => handleChange('driver_phone', e.target.value)}
          placeholder="Driver contact number"
          disabled={readOnly}
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Pickup Location</label>
          <input
            type="text"
            value={logistics.pickup_location || ''}
            onChange={(e) => handleChange('pickup_location', e.target.value)}
            placeholder="Pickup point"
            disabled={readOnly}
          />
        </div>
        <div className="form-group">
          <label>Dropoff Location</label>
          <input
            type="text"
            value={logistics.dropoff_location || ''}
            onChange={(e) => handleChange('dropoff_location', e.target.value)}
            placeholder="Dropoff point"
            disabled={readOnly}
          />
        </div>
      </div>
      
      <div className="form-group">
        <label>Insurance Policy</label>
        <input
          type="text"
          value={logistics.insurance_policy || ''}
          onChange={(e) => handleChange('insurance_policy', e.target.value)}
          placeholder="Policy number or details"
          disabled={readOnly}
        />
      </div>
      
      <div className="form-group">
        <label>Radio Channel</label>
        <input
          type="text"
          value={logistics.radio_channel || ''}
          onChange={(e) => handleChange('radio_channel', e.target.value)}
          placeholder="Group radio frequency"
          disabled={readOnly}
        />
      </div>
      
      <div className="form-group">
        <label>Emergency Contacts</label>
        <textarea
          value={logistics.emergency_contacts || ''}
          onChange={(e) => handleChange('emergency_contacts', e.target.value)}
          placeholder="Park ranger, rescue team, etc."
          disabled={readOnly}
          rows={3}
        />
      </div>
      
      <div className="form-group">
        <label>Notes</label>
        <textarea
          value={logistics.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Additional logistics notes..."
          disabled={readOnly}
          rows={3}
        />
      </div>
    </div>
  );
};

/**
 * GearChecklist - Gear packing checklist (FR-D03)
 */
const GearChecklist = ({ checklist = [], onUpdate, readOnly }) => {
  const [newItem, setNewItem] = useState({ item_name: '', category: 'personal' });

  const handleAddItem = () => {
    if (!newItem.item_name.trim()) return;
    
    const item = {
      id: `gear-${Date.now()}`,
      item_name: newItem.item_name.trim(),
      category: newItem.category,
      is_checked: false,
      quantity: 1,
    };
    
    onUpdate([...checklist, item]);
    setNewItem({ item_name: '', category: 'personal' });
  };

  const handleToggleCheck = (itemId) => {
    onUpdate(checklist.map(item => 
      item.id === itemId ? { ...item, is_checked: !item.is_checked } : item
    ));
  };

  const handleRemoveItem = (itemId) => {
    onUpdate(checklist.filter(item => item.id !== itemId));
  };

  // Group items by category
  const groupedItems = checklist.reduce((acc, item) => {
    const cat = item.category || 'personal';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryLabels = {
    group: '👥 Group Gear',
    personal: '🎒 Personal Gear',
    safety: '🛡️ Safety Equipment',
    cooking: '🍳 Cooking',
    shelter: '⛺ Shelter',
  };

  return (
    <div className="gear-checklist">
      <h4 className="form-section-title">Gear Checklist</h4>
      
      {/* Grouped items */}
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="gear-category">
          <h5 className="category-header">{categoryLabels[category] || category}</h5>
          <ul className="gear-list">
            {items.map((item) => (
              <li key={item.id} className={`gear-item ${item.is_checked ? 'checked' : ''}`}>
                <label className="gear-checkbox">
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={() => handleToggleCheck(item.id)}
                    disabled={readOnly}
                  />
                  <span className="gear-name">
                    {item.quantity > 1 && <span className="quantity">×{item.quantity}</span>}
                    {item.item_name}
                  </span>
                </label>
                {!readOnly && (
                  <button 
                    className="btn-remove-gear"
                    onClick={() => handleRemoveItem(item.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      
      {/* Add new item */}
      {!readOnly && (
        <div className="gear-add-form">
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            className="select-category"
          >
            <option value="personal">Personal</option>
            <option value="group">Group</option>
            <option value="safety">Safety</option>
            <option value="cooking">Cooking</option>
            <option value="shelter">Shelter</option>
          </select>
          <input
            type="text"
            value={newItem.item_name}
            onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
            placeholder="Item name..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
          />
          <button 
            onClick={handleAddItem}
            disabled={!newItem.item_name.trim()}
            className="btn-add-gear"
          >
            +
          </button>
        </div>
      )}
      
      {/* Progress summary */}
      {checklist.length > 0 && (
        <div className="gear-progress">
          <span className="progress-text">
            {checklist.filter(i => i.is_checked).length} / {checklist.length} packed
          </span>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${(checklist.filter(i => i.is_checked).length / checklist.length) * 100}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SettingsPanel - Plan metadata settings
 */
const SettingsPanel = ({ plan, onUpdate, readOnly }) => {
  const handleChange = (field, value) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="settings-panel">
      <h4 className="form-section-title">Plan Settings</h4>
      
      <div className="form-group">
        <label>Plan Name</label>
        <input
          type="text"
          value={plan?.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          disabled={readOnly}
        />
      </div>
      
      <div className="form-group">
        <label>Region</label>
        <input
          type="text"
          value={plan?.region || ''}
          onChange={(e) => handleChange('region', e.target.value)}
          placeholder="e.g., Taiwan, Alps, Rockies"
          disabled={readOnly}
        />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Start Date</label>
          <input
            type="date"
            value={plan?.planned_start_date ? plan.planned_start_date.split('T')[0] : ''}
            onChange={(e) => handleChange('planned_start_date', e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input
            type="date"
            value={plan?.planned_end_date ? plan.planned_end_date.split('T')[0] : ''}
            onChange={(e) => handleChange('planned_end_date', e.target.value)}
            disabled={readOnly}
          />
        </div>
      </div>
      
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={plan?.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe your expedition..."
          disabled={readOnly}
          rows={4}
        />
      </div>
      
      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={plan?.is_public || false}
            onChange={(e) => handleChange('is_public', e.target.checked)}
            disabled={readOnly}
          />
          <span>Public Plan</span>
        </label>
        <p className="help-text">Public plans can be viewed by anyone with the link.</p>
      </div>
    </div>
  );
};

/**
 * OperationsPanel - Main component
 */
const OperationsPanel = ({
  plan,
  roster = [],
  logistics = {},
  checklist = [],
  onUpdateRoster,
  onUpdateLogistics,
  onUpdateChecklist,
  onUpdatePlan,
  onSave,
  saving = false,
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState(TABS.TEAM);
  const [hasChanges, setHasChanges] = useState(false);

  // Wrap update handlers to track changes
  const handleRosterUpdate = useCallback((newRoster) => {
    onUpdateRoster(newRoster);
    setHasChanges(true);
  }, [onUpdateRoster]);

  const handleLogisticsUpdate = useCallback((newLogistics) => {
    onUpdateLogistics(newLogistics);
    setHasChanges(true);
  }, [onUpdateLogistics]);

  const handleChecklistUpdate = useCallback((newChecklist) => {
    onUpdateChecklist(newChecklist);
    setHasChanges(true);
  }, [onUpdateChecklist]);

  const handlePlanUpdate = useCallback((updates) => {
    onUpdatePlan(updates);
    setHasChanges(true);
  }, [onUpdatePlan]);

  const handleSave = useCallback(() => {
    onSave();
    setHasChanges(false);
  }, [onSave]);

  return (
    <div className="operations-panel">
      {/* Tab navigation */}
      <div className="ops-tabs">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            className={`ops-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="ops-content">
        {activeTab === TABS.TEAM && (
          <div className="tab-panel">
            <RosterForm 
              roster={roster} 
              onUpdate={handleRosterUpdate} 
              readOnly={readOnly} 
            />
            <LogisticsForm 
              logistics={logistics} 
              onUpdate={handleLogisticsUpdate} 
              readOnly={readOnly} 
            />
          </div>
        )}

        {activeTab === TABS.GEAR && (
          <div className="tab-panel">
            <GearChecklist 
              checklist={checklist} 
              onUpdate={handleChecklistUpdate} 
              readOnly={readOnly} 
            />
          </div>
        )}

        {activeTab === TABS.SETTINGS && (
          <div className="tab-panel">
            <SettingsPanel 
              plan={plan} 
              onUpdate={handlePlanUpdate} 
              readOnly={readOnly} 
            />
          </div>
        )}
      </div>

      {/* Save button */}
      {!readOnly && hasChanges && (
        <div className="ops-footer">
          <button 
            className="btn-save-ops"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};

OperationsPanel.propTypes = {
  plan: PropTypes.object,
  roster: PropTypes.array,
  logistics: PropTypes.object,
  checklist: PropTypes.array,
  onUpdateRoster: PropTypes.func.isRequired,
  onUpdateLogistics: PropTypes.func.isRequired,
  onUpdateChecklist: PropTypes.func.isRequired,
  onUpdatePlan: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  readOnly: PropTypes.bool,
};

export default OperationsPanel;
