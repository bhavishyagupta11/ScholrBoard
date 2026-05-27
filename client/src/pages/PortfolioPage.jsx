/**
 * PortfolioPage.jsx — Real dynamic portfolio view
 * Uses data from ProfileContext
 */
import { Save, Copy, Link as LinkIcon, Github, Award, Briefcase, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function PortfolioPage() {
  const { profile, isLoading, error } = useProfile();

  // Scroll animation hooks
  const headerRef   = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const profileRef  = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });
  const certsRef    = useScrollAnimation({ animationClass: 'fade-in-left', delay: 0.3 });
  const projectsRef = useScrollAnimation({ animationClass: 'fade-in-right', delay: 0.4 });
  const skillsRef   = useScrollAnimation({ animationClass: 'fade-in-left', delay: 0.5 });
  const linksRef    = useScrollAnimation({ animationClass: 'fade-in-right', delay: 0.6 });
  const codingRef   = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.7 });
  const trackerRef  = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.8 });

  if (isLoading) {
    return <div className="skeleton h-64 w-full" />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (!profile) return null;

  // Derive coding data for chart
  const codingData = [
    { lang: 'LeetCode', solved: profile.codingStats?.leetcodeProblemsSolved || 0 },
    { lang: 'Contest Rating', solved: profile.codingStats?.leetcodeContestRating || 0 },
    { lang: 'GitHub Commits', solved: profile.codingStats?.githubContributions || 0 },
  ].filter(d => d.solved > 0);

  return (
    <div className="space-y-6">
      <h1 ref={headerRef} className="text-2xl font-semibold gpu-accelerated">My Portfolio</h1>

      <div ref={profileRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
        <div className="grid md:grid-cols-4 gap-4 items-center">
          <div>
            <div className="text-sm text-slate-500">Name</div>
            <div className="font-semibold text-lg">{profile.name}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Student ID</div>
            <div className="font-semibold text-lg">{profile.studentId || '–'}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">GPA</div>
            <div className="font-semibold text-lg">{profile.gpa || '–'}</div>
          </div>
          <div className="flex items-end gap-2 md:justify-end">
            <button className="btn btn-outline hover:scale-105 transition-transform"><Save size={16}/> Save PDF</button>
            <button className="btn btn-outline hover:scale-105 transition-transform"><Copy size={16}/> Copy Link</button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div ref={certsRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
          <div className="font-medium mb-4 flex items-center gap-2 text-lg"><Award size={18} className="text-blue-400"/> Education &amp; Certifications</div>
          {(profile.education || []).length === 0 && (profile.certifications || []).length === 0 ? (
            <div className="text-sm subtle">No records added.</div>
          ) : (
            <div className="space-y-4">
              {(profile.education || []).map((edu, i) => (
                <div key={i} className="text-sm">
                  <div className="font-semibold">{edu.degree}</div>
                  <div className="subtle">{edu.institution} ({edu.endYear || edu.startYear || 'Present'})</div>
                </div>
              ))}
              {(profile.certifications || []).map((cert, i) => (
                <div key={`cert-${i}`} className="text-sm">
                  <div className="font-semibold">{cert.title}</div>
                  <div className="subtle">
                    {cert.issuedBy || 'Issuer not set'}
                    {cert.issuedDate ? ` (${new Date(cert.issuedDate).getFullYear()})` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div ref={projectsRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
          <div className="font-medium mb-4 flex items-center gap-2 text-lg"><Briefcase size={18} className="text-blue-400"/> Projects</div>
          {(profile.projects || []).length === 0 ? (
            <div className="text-sm subtle">No projects added.</div>
          ) : (
            <ul className="space-y-3">
              {profile.projects.map((project, i) => (
                <li key={i} className="text-sm p-3 rounded-lg border" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
                  <div className="font-semibold text-base">{project.name}</div>
                  <div className="subtle mt-1">{project.description}</div>
                  {(project.githubLink || project.liveLink) && (
                    <div className="flex gap-3 mt-2">
                      {project.githubLink && <a href={project.githubLink} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">GitHub</a>}
                      {project.liveLink && <a href={project.liveLink} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Live</a>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div ref={skillsRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
          <div className="font-medium mb-4 text-lg">Skills</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {(profile.skills || []).length === 0 ? (
              <span className="subtle">No skills added.</span>
            ) : (
              profile.skills.map(s => (
                <span key={s} className="px-3 py-1 rounded-full font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--primary-blue)' }}>{s}</span>
              ))
            )}
          </div>
        </div>
        <div ref={linksRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
          <div className="font-medium mb-4 flex items-center gap-2 text-lg"><LinkIcon size={18} className="text-blue-400"/> Links</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {profile.socialLinks?.portfolio && <a className="text-blue-400 underline" target="_blank" rel="noreferrer" href={profile.socialLinks.portfolio}>Portfolio</a>}
            {profile.socialLinks?.linkedin && <a className="text-blue-400 underline" target="_blank" rel="noreferrer" href={profile.socialLinks.linkedin}>LinkedIn</a>}
            {profile.socialLinks?.github && <a className="text-blue-400 underline flex items-center gap-1" target="_blank" rel="noreferrer" href={profile.socialLinks.github}><Github size={14}/> GitHub</a>}
            {profile.socialLinks?.leetcode && <a className="text-blue-400 underline" target="_blank" rel="noreferrer" href={profile.socialLinks.leetcode}>LeetCode</a>}
            {!profile.socialLinks || Object.values(profile.socialLinks).every(v => !v) ? <span className="subtle col-span-2">No links added.</span> : null}
          </div>
        </div>
      </div>

      <div ref={codingRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
        <div className="font-medium mb-4 text-lg">Coding Profile</div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm subtle">LeetCode Solved</div>
              <div className="text-3xl font-bold text-blue-500">{profile.codingStats?.leetcodeProblemsSolved || 0}</div>
            </div>
            <div>
              <div className="text-sm subtle">Contest Rating</div>
              <div className="text-3xl font-bold text-green-500">{profile.codingStats?.leetcodeContestRating || 0}</div>
            </div>
            <div>
              <div className="text-sm subtle">GitHub Commits</div>
              <div className="text-3xl font-bold text-purple-500">{profile.codingStats?.githubContributions || 0}</div>
            </div>
          </div>
          <div className="md:col-span-2 h-56">
            {codingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={codingData}>
                  <XAxis dataKey="lang" stroke="var(--text-secondary)" fontSize={12} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--surface-card)', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="solved" fill="var(--primary-blue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center border border-dashed rounded-lg text-sm subtle" style={{ borderColor: 'var(--border-color)' }}>
                No coding data to display
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
