import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Download, Trash2, LogOut, ChevronRight, Edit3, Check, X, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { HealthProfileRepository } from '../repositories/HealthProfileRepository';
import { PlanRepository } from '../repositories/PlanRepository';
import { DailyTaskRepository } from '../repositories/DailyTaskRepository';
import { BodyMeasurementRepository } from '../repositories/BodyMeasurementRepository';
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    PlanRepository.getHistory(user.id).then(setPlanHistory);
  }, [user]);

  async function saveName() {
    if (!user || !newName.trim()) return;
    setSavingName(true);
    await ProfileRepository.update(user.id, { display_name: newName.trim() });
    await refreshProfile();
    setSavingName(false);
    setEditingName(false);
  }

  async function savePhone() {
    if (!user) return;
    setSavingPhone(true);
    await ProfileRepository.update(user.id, { phone_number: newPhone.trim() || null });
    await refreshProfile();
    setSavingPhone(false);
    setEditingPhone(false);
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
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <span className="text-2xl font-bold text-emerald-400">
                {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
              </span>
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
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="Mobile number"
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && savePhone()}
                  />
                  <button onClick={savePhone} disabled={savingPhone} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingPhone(false)} className="text-gray-500 hover:text-gray-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-gray-500">{profile?.phone_number || 'No mobile number'}</p>
                  <button onClick={() => { setNewPhone(profile?.phone_number ?? ''); setEditingPhone(true); }} className="text-gray-600 hover:text-gray-400 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {profile?.invite_code && (
                <p className="text-xs text-gray-600 mt-0.5">Invite code: <span className="font-mono text-gray-400">{profile.invite_code}</span></p>
              )}
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
