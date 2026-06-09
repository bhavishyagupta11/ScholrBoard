/**
 * ProfilePage.jsx — Full profile management with real API persistence
 *
 * Sections:
 *   1. Header (avatar, name, role badge)
 *   2. Personal Details (bio, phone, GPA — editable)
 *   3. Skills (add/remove tags)
 *   4. Goals & Interests
 *   5. Coding Stats
 *   6. Social Links
 *   7. Daily Learning Streaks (from analytics)
 *
 * All saves go to /api/profile/me (MongoDB) — no more localStorage.
 */
import { useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';
import uploadApi from '../api/upload.api.js';
import {
  User, Mail, BookOpen, Code2, Target, Link as LinkIcon,
  Camera, Plus, X, Save, Edit3, CheckCircle, AlertCircle,
} from 'lucide-react';

// ─── Skill Tag component ──────────────────────────────────────────────────────
function SkillTag({ skill, onRemove, editing }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
      style={{ background: 'var(--accent-soft)', color: 'var(--primary-blue)' }}>
      {skill}
      {editing && (
        <button onClick={() => onRemove(skill)} className="ml-1 hover:text-red-400 transition-colors">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const { profile, updateProfile, updateBasicInfo, isLoading, error, refreshProfile } = useProfile();

  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [newSkill, setNewSkill]       = useState('');

  // Local form state (only used when editing = true)
  const [form, setForm] = useState({});

  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });

  // Start editing — copy current profile into form state
  const startEditing = () => {
    setForm({
      bio:                       profile?.bio || '',
      phone:                     profile?.phone || '',
      gpa:                       profile?.gpa || '',
      attendanceOverall:         profile?.attendanceOverall || '',
      careerGoal:                profile?.careerGoal || '',
      learningGoalMinutesPerDay: profile?.learningGoalMinutesPerDay || 30,
      skills:                    [...(profile?.skills || [])],
      interests:                 [...(profile?.interests || [])],
      targetCompanies:           [...(profile?.targetCompanies || [])],
      socialLinks: {
        github:    profile?.socialLinks?.github    || '',
        linkedin:  profile?.socialLinks?.linkedin  || '',
        leetcode:  profile?.socialLinks?.leetcode  || '',
        portfolio: profile?.socialLinks?.portfolio || '',
      },
    });
    setSaveError(null);
    setSaveSuccess(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setSaveError(null);
  };

  // Save all form changes
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateProfile({
        bio:                       form.bio,
        ...(form.phone?.trim() ? { phone: form.phone.trim() } : { phone: null }),
        gpa:                       form.gpa ? parseFloat(form.gpa) : undefined,
        attendanceOverall:         form.attendanceOverall ? parseFloat(form.attendanceOverall) : undefined,
        careerGoal:                form.careerGoal,
        learningGoalMinutesPerDay: parseInt(form.learningGoalMinutesPerDay),
        skills:                    form.skills,
        interests:                 form.interests,
        targetCompanies:           form.targetCompanies,
        socialLinks:               form.socialLinks,
      });
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Handle avatar upload
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      await uploadApi.uploadAvatar(file);
      await refreshProfile();
    } catch (err) {
      setSaveError('Avatar upload failed: ' + err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !form.skills.includes(s)) {
      setForm((f) => ({ ...f, skills: [...f.skills, s] }));
    }
    setNewSkill('');
  };

  const removeSkill = (skill) => {
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-40 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const displaySkills = editing ? form.skills : (profile?.skills || []);
  const displayName   = profile?.name   || user?.displayName || 'Your Name';
  const displayEmail  = profile?.email  || user?.email || '';
  const displayAvatar = profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff`;

  return (
    <div className="space-y-6">
      <h1 ref={headerRef} className="headline gpu-accelerated">My Profile</h1>

      {/* ─── Status Messages ────────────────────────────────────────────────── */}
      {saveSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success-color)', border: '1px solid var(--success-color)' }}>
          <CheckCircle size={16} /> Profile saved successfully
        </div>
      )}
      {(saveError || error) && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {saveError || error}
        </div>
      )}

      {/* ─── Profile Header ─────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={displayAvatar}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover border-2"
              style={{ borderColor: 'var(--primary-blue)' }}
            />
            <label className="absolute -bottom-1 -right-1 p-1.5 rounded-full cursor-pointer" style={{ background: 'var(--primary-blue)' }}>
              {avatarUploading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={14} className="text-white" />
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>

          {/* Identity */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{displayName}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm subtle">
              <Mail size={14} /> {displayEmail}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--primary-blue)' }}>
                {profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1)}
              </span>
              {profile?.department && (
                <span className="badge" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>
                  {profile.department}
                </span>
              )}
              {profile?.semester && (
                <span className="badge" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>
                  Semester {profile.semester}
                </span>
              )}
              {profile?.studentId && (
                <span className="badge" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>
                  {profile.studentId}
                </span>
              )}
            </div>
          </div>

          {/* Edit button */}
          <div>
            {!editing ? (
              <button onClick={startEditing} className="btn btn-outline flex items-center gap-2">
                <Edit3 size={15} /> Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="btn btn-primary flex items-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={cancelEditing} className="btn btn-outline">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Two-column layout ──────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Personal Details */}
        <Section title="Personal Details" icon={<User size={16} />}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Bio', key: 'bio', type: 'textarea', span: 2 },
              { label: 'Phone', key: 'phone', type: 'text' },
              { label: 'GPA (out of 10)', key: 'gpa', type: 'number', step: '0.1', min: '0', max: '10' },
              { label: 'Attendance (%)', key: 'attendanceOverall', type: 'number', min: '0', max: '100' },
              { label: 'Daily Study Goal (mins)', key: 'learningGoalMinutesPerDay', type: 'number', min: '0' },
            ].map(({ label, key, type, span, ...inputProps }) => (
              <div key={key} className={span === 2 ? 'col-span-2' : ''}>
                <div className="subtle mb-1">{label}</div>
                {editing ? (
                  type === 'textarea' ? (
                    <textarea
                      className="input-dark w-full resize-none"
                      rows={3}
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type={type}
                      className="input-dark w-full"
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      {...inputProps}
                    />
                  )
                ) : (
                  <div style={{ color: 'var(--text-primary)' }}>{profile?.[key] || <span className="subtle">Not set</span>}</div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Skills */}
        <Section title="Skills" icon={<Code2 size={16} />}>
          <div className="flex flex-wrap gap-2 mb-3">
            {displaySkills.length === 0 && !editing ? (
              <span className="subtle text-sm">No skills added yet</span>
            ) : (
              displaySkills.map((skill) => (
                <SkillTag key={skill} skill={skill} editing={editing} onRemove={removeSkill} />
              ))
            )}
          </div>
          {editing && (
            <div className="flex gap-2">
              <input
                className="input-dark flex-1 text-sm"
                placeholder="Add a skill..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSkill()}
              />
              <button onClick={addSkill} className="btn btn-primary px-3">
                <Plus size={16} />
              </button>
            </div>
          )}
        </Section>

        {/* Career Goals */}
        <Section title="Career Goals" icon={<Target size={16} />}>
          <div className="space-y-3 text-sm">
            <div>
              <div className="subtle mb-1">Career Goal</div>
              {editing ? (
                <textarea
                  className="input-dark w-full resize-none"
                  rows={2}
                  value={form.careerGoal || ''}
                  onChange={(e) => setForm((f) => ({ ...f, careerGoal: e.target.value }))}
                  placeholder="e.g. Software Engineer at a top tech company"
                />
              ) : (
                <div style={{ color: 'var(--text-primary)' }}>{profile?.careerGoal || <span className="subtle">Not set</span>}</div>
              )}
            </div>
            <div>
              <div className="subtle mb-1">Target Companies</div>
              {editing ? (
                <input
                  className="input-dark w-full text-sm"
                  placeholder="e.g. Google, Microsoft, Amazon (comma-separated)"
                  value={(form.targetCompanies || []).join(', ')}
                  onChange={(e) => setForm((f) => ({ ...f, targetCompanies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(profile?.targetCompanies || []).length === 0 ? (
                    <span className="subtle">Not set</span>
                  ) : (
                    profile.targetCompanies.map((c) => <SkillTag key={c} skill={c} editing={false} />)
                  )}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Social Links */}
        <Section title="Social Links" icon={<LinkIcon size={16} />}>
          <div className="space-y-2 text-sm">
            {['github', 'linkedin', 'leetcode', 'portfolio'].map((platform) => {
              const val = editing ? form.socialLinks?.[platform] : profile?.socialLinks?.[platform];
              return (
                <div key={platform} className="flex items-center gap-2">
                  <span className="subtle capitalize w-20 flex-shrink-0">{platform}</span>
                  {editing ? (
                    <input
                      className="input-dark flex-1 text-sm"
                      placeholder={`https://${platform}.com/...`}
                      value={form.socialLinks?.[platform] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [platform]: e.target.value } }))}
                    />
                  ) : val ? (
                    <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline truncate">{val}</a>
                  ) : (
                    <span className="subtle">Not set</span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ─── Coding Stats ────────────────────────────────────────────────────── */}
      {profile?.codingStats && (
        <Section title="Coding Statistics" icon={<Code2 size={16} />}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'LeetCode Solved', val: profile.codingStats.leetcodeProblemsSolved },
              { label: 'Contest Rating', val: profile.codingStats.leetcodeContestRating },
              { label: 'LeetCode Streak', val: profile.codingStats.leetcodeStreak ? `${profile.codingStats.leetcodeStreak} days` : null },
              { label: 'GitHub Contributions', val: profile.codingStats.githubContributions },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-medium)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--primary-blue)' }}>{val ?? '–'}</div>
                <div className="subtle mt-1">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs subtle mt-3">
            Update your coding stats in{' '}
            <a href="/student/coding" className="underline" style={{ color: 'var(--primary-blue)' }}>
              Coding Profiles
            </a>
          </p>
        </Section>
      )}
    </div>
  );
}
