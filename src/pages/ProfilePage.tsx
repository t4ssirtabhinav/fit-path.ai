import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Download, Trash2, LogOut, ChevronRight, Edit3, Check, X, FileText, Lock, Eye, EyeOff, Camera, ListChecks } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { HealthProfileRepository } from '../repositories/HealthProfileRepository';
import { PlanRepository } from '../repositories/PlanRepository';
import { DailyTaskRepository } from '../repositories/DailyTaskRepository';
import { BodyMeasurementRepository } from '../repositories/BodyMeasurementRepository';
import { TrackingConfigRepository } from '../repositories/TrackingConfigRepository';
import { TRACKERS } from '../config/trackers';
import { useHealthProfile } from '../hooks/useHealthProfile';

interface PlanHistoryItem {
  id: string;
  phase: number;
  is_active: boolean;
  generated_at: string;
}

export function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { healthProfile: hp } = useHealthProfile(user?.id);
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const [selectedTrackers, setSelectedTrackers] = useState<string[]>([]);
  const [reminderMorning, setReminderMorning] = useState('');
  const [reminderEvening, setReminderEvening] = useState('');
  const [savingTrackers, setSavingTrackers] = useState(false);
  const [trackersSaved, setTrackersSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    PlanRepository.getHistory(user.id).then(setPlanHistory);
  }, [user]);

  useEffect(() => {
    if (!user || profile?.onboarding_path !== 'track') return;
    TrackingConfigRepository.getForUser(user.id).then(config => {
      if (!config) return;
      setSelectedTrackers(config.selected_trackers);
      setReminderMorning(config.reminder_morning ?? '');
      setReminderEvening(config.reminder_evening ?? '');
    });
  }, [user, profile?.onboarding_path]);

  function toggleTracker(id: string) {
    setTrackersSaved(false);
    setSelectedTrackers(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  async function saveTrackingConfig() {
    if (!user) return;
    setSavingTrackers(true);
    await TrackingConfigRepository.upsert(user.id, {
      selected_trackers: selectedTrackers,
      reminder_morning: reminderMorning || null,
      reminder_evening: reminderEvening || null,
    });
    setSavingTrackers(false);
    setTrackersSaved(true);
  }

  async function saveName() {
    if (!user || !newName.trim()) return;
    setEditingName(false);
    const trimmed = newName.trim();
    if (trimmed === profile?.display_name) return;
    setSavingName(true);
    await ProfileRepository.update(user.id, { display_name: trimmed });
    await refreshProfile();
    setSavingName(false);
  }

  const PHONE_PATTERN = /^\+?[0-9\s-]{7,15}$/;

  async function savePhone() {
    if (!user) return;
    const trimmed = newPhone.trim();
    if (trimmed && !PHONE_PATTERN.test(trimmed)) {
      setPhoneError('Enter a valid phone number (7-15 digits, optional + prefix).');
      return;
    }
    setPhoneError('');
    setEditingPhone(false);
    const next = trimmed || null;
    if (next === (profile?.phone_number ?? null)) return;
    setSavingPhone(true);
    await ProfileRepository.update(user.id, { phone_number: next });
    await refreshProfile();
    setSavingPhone(false);
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Image must be smaller than 5MB.'); return; }
    setAvatarError('');
    setAvatarUploading(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      setAvatarError(uploadError.message);
      setAvatarUploading(false);
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await ProfileRepository.update(user.id, { avatar_url: `${data.publicUrl}?t=${Date.now()}` });
    await refreshProfile();
    setAvatarUploading(false);
  }

  async function changePassword() {
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setPasswordError('');
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setChangingPassword(false);
    setPasswordSuccess(true);
  }

  async function exportData() {
    if (!user) return;
    setExportLoading(true);
    const [measurements, taskLogs, plans] = await Promise.all([
      BodyMeasurementRepository.getAllForUser(user.id),
      DailyTaskRepository.getAllLogs(user.id),
      PlanRepository.getAllPlanData(user.id),
    ]);
    const exportObj = {
      profile,
      health_profile: hp,
      measurements,
      task_logs: taskLogs,
      plans,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitpath-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportLoading(false);
  }

  async function deleteAccount() {
    if (!user) return;
    // Delete all user data (CASCADE handles most of it)
    await HealthProfileRepository.delete(user.id);
    await ProfileRepository.delete(user.id);
    await supabase.auth.signOut();
  }

  const statRows = hp ? [
    { label: 'Age', value: hp.age ? `${hp.age} years` : '—' },
    { label: 'Weight', value: hp.weight_kg ? `${hp.weight_kg} kg` : '—' },
    { label: 'Height', value: hp.height_cm ? `${hp.height_cm} cm` : '—' },
    { label: 'Gender', value: hp.gender ?? '—' },
    { label: 'Activity level', value: hp.activity_level?.replace(/_/g, ' ') ?? '—' },
    { label: 'Diet type', value: hp.diet_type?.replace(/_/g, ' ') ?? '—' },
    { label: 'Active days/week', value: hp.commitment_days_per_week ? `${hp.commitment_days_per_week} days` : '—' },
    { label: 'Current sleep', value: hp.sleep_hours_current ? `${hp.sleep_hours_current}h` : '—' },
  ] : [];

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 lg:pb-8">
      {/* Profile header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-emerald-400">
                    {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors">
                <Camera className="w-3.5 h-3.5 text-gray-300" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                  />
                  <button onClick={saveName} disabled={savingName} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-gray-500 hover:text-gray-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{profile?.display_name}</h2>
                  <button onClick={() => { setNewName(profile?.display_name ?? ''); setEditingName(true); }} className="text-gray-600 hover:text-gray-400 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-500">{user?.email}</p>
              {editingPhone ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={e => { setNewPhone(e.target.value); setPhoneError(''); }}
                      placeholder="Mobile number"
                      className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && savePhone()}
                    />
                    <button onClick={savePhone} disabled={savingPhone} className="text-emerald-400 hover:text-emerald-300">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditingPhone(false); setPhoneError(''); }} className="text-gray-500 hover:text-gray-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {phoneError && <p className="text-xs text-red-400 mt-1">{phoneError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-gray-500">{profile?.phone_number || 'No mobile number'}</p>
                  <button onClick={() => { setNewPhone(profile?.phone_number ?? ''); setEditingPhone(true); setPhoneError(''); }} className="text-gray-600 hover:text-gray-400 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {profile?.invite_code && (
                <p className="text-xs text-gray-600 mt-0.5">Invite code: <span className="font-mono text-gray-400">{profile.invite_code}</span></p>
              )}
              {avatarUploading && <p className="text-xs text-gray-500 mt-0.5">Uploading photo…</p>}
              {avatarError && <p className="text-xs text-red-400 mt-0.5">{avatarError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health stats */}
      {hp && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-white">Health Profile</h2>
              </div>
              <button
                onClick={() => navigate('/onboarding')}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                Update <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {statRows.map(row => (
                <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-500">{row.label}</span>
                  <span className="text-sm text-white capitalize">{row.value}</span>
                </div>
              ))}
            </div>
            {hp.fitness_goals.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Goals</p>
                <div className="flex flex-wrap gap-1.5">
                  {hp.fitness_goals.map(g => (
                    <span key={g} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {g.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracking settings (track-only users) */}
      {profile?.onboarding_path === 'track' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-white">Tracking Setup</h2>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-xs text-gray-500">Choose what you want to log on your Today page.</p>
            <div className="space-y-2">
              {TRACKERS.map(t => {
                const active = selectedTrackers.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTracker(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-left ${
                      active ? 'bg-emerald-500/10 border-emerald-500/60' : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{t.label}</p>
                      <p className="text-xs text-gray-500">{t.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      active ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                    }`}>
                      {active && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Morning reminder</label>
                <input
                  type="time"
                  value={reminderMorning}
                  onChange={e => { setReminderMorning(e.target.value); setTrackersSaved(false); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Evening reminder</label>
                <input
                  type="time"
                  value={reminderEvening}
                  onChange={e => { setReminderEvening(e.target.value); setTrackersSaved(false); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            {trackersSaved && (
              <p className="text-xs text-emerald-400">Tracking setup saved. New choices apply from tomorrow's checklist onward.</p>
            )}
            <Button size="sm" onClick={saveTrackingConfig} loading={savingTrackers} disabled={selectedTrackers.length === 0}>
              Save tracking setup
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan History */}
      {planHistory.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-white">Plan History</h2>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {planHistory.map(plan => (
                <div key={plan.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                      {plan.is_active ? 'Active' : 'Archived'}
                    </span>
                    <span className="text-sm text-white">Phase {plan.phase}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(plan.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-white">Security</h2>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {passwordSuccess && !changingPassword && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
              <p className="text-emerald-400 text-sm">Password updated successfully.</p>
            </div>
          )}
          {!changingPassword ? (
            <button
              onClick={() => { setChangingPassword(true); setPasswordSuccess(false); setPasswordError(''); }}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-gray-600 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              Change password
            </button>
          ) : (
            <div className="space-y-3">
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-400 text-sm">{passwordError}</p>
                </div>
              )}
              <div className="relative">
                <Input
                  label="New password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  hint="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-8 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                label="Confirm new password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={changePassword} loading={passwordSaving}>Update password</Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); setPasswordError(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy & data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-white">Privacy & Data</h2>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <p className="text-xs text-gray-500 leading-relaxed mb-3">
            Your health data is stored securely and never shared with third parties. You can export or delete your data at any time in compliance with privacy regulations.
          </p>
          <button
            onClick={exportData}
            disabled={exportLoading}
            className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-gray-600 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            {exportLoading ? 'Preparing export...' : 'Export all my data (JSON)'}
          </button>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="w-full flex items-center gap-3 py-3 px-4 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-red-500/30 text-sm text-gray-300 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete my account and all data
            </button>
          ) : (
            <div className="border border-red-500/30 rounded-xl p-4 bg-red-500/5">
              <p className="text-sm text-red-400 font-medium mb-1">Are you sure?</p>
              <p className="text-xs text-gray-500 mb-3">This permanently deletes all your data. This cannot be undone.</p>
              <div className="flex gap-2">
                <Button variant="danger" size="sm" onClick={deleteAccount}>Yes, delete everything</Button>
                <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 text-sm transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
        <p className="text-xs text-amber-300/70 text-center leading-relaxed">
          FitPath provides general fitness and nutrition guidance only. This is not medical advice. Always consult a qualified healthcare professional before starting any new diet, supplement, or exercise programme.
        </p>
      </div>
    </div>
  );
}
