import React, { useState, useEffect, useMemo } from 'react';
import { useTalentDiscovery } from '../hooks/useTalentDiscovery.js';
import CandidateDetailDrawer from '../components/developer/CandidateDetailDrawer.jsx';
import { 
  Search, 
  Download, 
  Filter, 
  Star, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  Code2, 
  Award,
  AlertTriangle,
  Github,
  Activity,
  Globe,
  Sliders,
  FileText,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map score to color badge */
function getScoreBadgeClass(score) {
  if (score >= 75) return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
  return 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20';
}

export function AdminTalentDiscovery() {
  const {
    filters,
    results,
    pagination,
    loading,
    error,
    updateFilters,
    resetFilters
  } = useTalentDiscovery();

  // Selected candidate for drawer
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Shortlisting local state (scholrboard_shortlist key)
  const [shortlistedIds, setShortlistedIds] = useState([]);

  // Load shortlisted IDs on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scholrboard_shortlist');
      if (saved) {
        setShortlistedIds(JSON.parse(saved));
      }
    } catch (err) {
      console.error('Failed to load shortlist from localStorage:', err);
    }
  }, []);

  // Shortlist action toggle
  const toggleShortlist = (userId) => {
    setShortlistedIds(prev => {
      let updated;
      if (prev.includes(userId)) {
        updated = prev.filter(id => id !== userId);
      } else {
        updated = [...prev, userId];
      }
      localStorage.setItem('scholrboard_shortlist', JSON.stringify(updated));
      return updated;
    });
  };

  // Clear all shortlist
  const clearShortlist = () => {
    setShortlistedIds([]);
    localStorage.removeItem('scholrboard_shortlist');
  };

  // Local Search state (debounced by React effect is handled under the hood or locally)
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  // Sync search filters to searchParams when local search completes or when Enter is pressed
  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    updateFilters({ search: localSearch });
  };

  // Local input states for filters to allow smooth editing before applying
  const [localGpaMin, setLocalGpaMin] = useState(filters.gpaMin || '');
  const [localGpaMax, setLocalGpaMax] = useState(filters.gpaMax || '');
  const [localDevMin, setLocalDevMin] = useState(filters.developerScoreMin || '');
  const [localAtsMin, setLocalAtsMin] = useState(filters.atsScoreMin || '');
  const [localSkills, setLocalSkills] = useState(filters.skills || '');

  // Sync filter values when searchParams change externally
  useEffect(() => {
    setLocalGpaMin(filters.gpaMin || '');
    setLocalGpaMax(filters.gpaMax || '');
    setLocalDevMin(filters.developerScoreMin || '');
    setLocalAtsMin(filters.atsScoreMin || '');
    setLocalSkills(filters.skills || '');
  }, [filters.gpaMin, filters.gpaMax, filters.developerScoreMin, filters.atsScoreMin, filters.skills]);

  // Apply filter states
  const applyRangeFilters = () => {
    updateFilters({
      gpaMin: localGpaMin,
      gpaMax: localGpaMax,
      developerScoreMin: localDevMin,
      atsScoreMin: localAtsMin,
      skills: localSkills
    });
  };

  // Sorting handlers
  const handleSort = (field) => {
    const currentSort = filters.sortBy || 'developerScore';
    const currentOrder = filters.sortOrder || 'desc';
    
    let newOrder = 'desc';
    if (currentSort === field && currentOrder === 'desc') {
      newOrder = 'asc';
    }
    updateFilters({ sortBy: field, sortOrder: newOrder });
  };

  // Excel Export visible rows using xlsx and file-saver
  const handleExportExcel = () => {
    if (results.length === 0) return;

    const exportRows = results.map(row => ({
      Name: row.name,
      Email: row.email,
      Department: row.department || 'N/A',
      Semester: row.semester || 'N/A',
      'Developer Score': row.developerScore,
      'GitHub Score': row.githubScore,
      'DSA Score': row.dsaScore,
      'CP Score': row.cpScore,
      GPA: row.gpa,
      'ATS Score': row.atsScore !== null ? row.atsScore : 'N/A',
      Shortlisted: shortlistedIds.includes(row._id) ? 'Yes' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
    
    // Write and save
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(blob, `ScholrBoard_Talent_Discovery_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Open drawer trigger
  const openCandidateDrawer = (userId) => {
    setSelectedUserId(userId);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6 fade-in-up">
      
      {/* ─── Search Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="headline">Talent Discovery</h1>
          <p className="text-sm subtle mt-1">
            Search, filter, and shortlist students by developer scores and academic GPA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {shortlistedIds.length > 0 && (
            <button
              onClick={clearShortlist}
              className="btn px-3 py-2 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/15 text-red-500 border border-red-500/20 flex items-center gap-1 cursor-pointer"
              type="button"
              title="Clear active shortlist"
            >
              <Trash2 size={13} />
              <span>Clear Shortlist ({shortlistedIds.length})</span>
            </button>
          )}
          
          <button
            onClick={handleExportExcel}
            disabled={results.length === 0}
            className="btn btn-primary px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
            type="button"
          >
            <Download size={14} />
            <span>Export XLS</span>
          </button>
        </div>
      </div>

      {/* Discovery metrics widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-[10px] uppercase font-bold text-neutral-400">Results Found</div>
          <div className="text-2xl font-extrabold text-white mt-1">{pagination.total}</div>
          <div className="text-[10px] subtle mt-0.5">Matching current filters</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase font-bold text-neutral-400">Active Shortlist</div>
          <div className="text-2xl font-extrabold text-blue-400 mt-1">{shortlistedIds.length}</div>
          <div className="text-[10px] subtle mt-0.5">Cached in local storage</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase font-bold text-neutral-400">Current Page</div>
          <div className="text-2xl font-extrabold text-white mt-1">{pagination.page}</div>
          <div className="text-[10px] subtle mt-0.5">of {pagination.totalPages} pages</div>
        </div>
        <div className="card p-4">
          <div className="text-[10px] uppercase font-bold text-neutral-400">Page Limit</div>
          <div className="text-2xl font-extrabold text-neutral-300 mt-1">{pagination.limit}</div>
          <div className="text-[10px] subtle mt-0.5">Rows per query</div>
        </div>
      </div>

      {/* Discovery Layout Grid */}
      <div className="grid lg:grid-cols-4 gap-6">
        
        {/* Left Side: Filter Sidebar Panel */}
        <div className="card p-5 space-y-5 h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
            <span className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
              <Sliders size={14} className="text-blue-400" />
              Search Filters
            </span>
            <button 
              onClick={resetFilters}
              className="text-[10px] font-bold text-blue-500 hover:underline cursor-pointer"
              type="button"
            >
              Reset All
            </button>
          </div>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 scrollbar-thin text-xs">
            
            {/* GPA Ranges */}
            <div className="space-y-2">
              <span className="font-bold text-neutral-400 block">GPA Range</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] subtle" htmlFor="gpa-min-input">Min GPA</label>
                  <input
                    id="gpa-min-input"
                    type="number"
                    min="0" max="10" step="0.1"
                    className="input-dark w-full px-2 py-1 mt-0.5 text-xs"
                    value={localGpaMin}
                    placeholder="0.0"
                    onChange={(e) => setLocalGpaMin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] subtle" htmlFor="gpa-max-input">Max GPA</label>
                  <input
                    id="gpa-max-input"
                    type="number"
                    min="0" max="10" step="0.1"
                    className="input-dark w-full px-2 py-1 mt-0.5 text-xs"
                    value={localGpaMax}
                    placeholder="10.0"
                    onChange={(e) => setLocalGpaMax(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Backlogs */}
            <div className="space-y-1">
              <label className="font-bold text-neutral-400 block" htmlFor="backlogs-max-select">Max Active Backlogs</label>
              <select
                id="backlogs-max-select"
                className="input-dark w-full px-2 py-1.5 text-xs"
                value={filters.backlogsMax}
                onChange={(e) => updateFilters({ backlogsMax: e.target.value })}
              >
                <option value="">Any Backlogs</option>
                <option value="0">0 (No Backlogs)</option>
                <option value="1">1 or fewer</option>
                <option value="2">2 or fewer</option>
              </select>
            </div>

            {/* Developer score range */}
            <div className="space-y-2">
              <span className="font-bold text-neutral-400 block">Minimum Developer Score</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0" max="100" step="5"
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                  value={localDevMin || 0}
                  onChange={(e) => setLocalDevMin(e.target.value === '0' ? '' : e.target.value)}
                  aria-label="Minimum Developer Score"
                />
                <span className="font-bold w-7 text-right">{localDevMin || 0}</span>
              </div>
            </div>

            {/* Subscore minimum filters */}
            <div className="space-y-1.5">
              <span className="font-bold text-neutral-400 block">Subscore Minimums</span>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div>
                  <label className="subtle block" htmlFor="git-score-min">Git score</label>
                  <input
                    id="git-score-min"
                    type="number"
                    min="0" max="100"
                    className="input-dark w-full px-1.5 py-0.5 text-xs mt-0.5"
                    value={filters.githubScoreMin}
                    placeholder="0"
                    onChange={(e) => updateFilters({ githubScoreMin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="subtle block" htmlFor="dsa-score-min">DSA score</label>
                  <input
                    id="dsa-score-min"
                    type="number"
                    min="0" max="100"
                    className="input-dark w-full px-1.5 py-0.5 text-xs mt-0.5"
                    value={filters.dsaScoreMin}
                    placeholder="0"
                    onChange={(e) => updateFilters({ dsaScoreMin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="subtle block" htmlFor="cp-score-min">CP score</label>
                  <input
                    id="cp-score-min"
                    type="number"
                    min="0" max="100"
                    className="input-dark w-full px-1.5 py-0.5 text-xs mt-0.5"
                    value={filters.cpScoreMin}
                    placeholder="0"
                    onChange={(e) => updateFilters({ cpScoreMin: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Skills keyword list */}
            <div className="space-y-1">
              <label className="font-bold text-neutral-400 block" htmlFor="skills-keyword-input">Required Skills</label>
              <input
                id="skills-keyword-input"
                type="text"
                placeholder="react, node, python"
                className="input-dark w-full px-2 py-1.5 text-xs"
                value={localSkills}
                onChange={(e) => setLocalSkills(e.target.value)}
              />
              <span className="text-[10px] subtle block mt-0.5">Comma-separated keywords</span>
            </div>

            {/* Connection settings */}
            <div className="space-y-2 pt-1 border-t border-neutral-800">
              <span className="font-bold text-neutral-400 block">Integration Connections</span>
              
              <div className="space-y-1">
                <label className="subtle block" htmlFor="git-connected-select">GitHub Connected</label>
                <select
                  id="git-connected-select"
                  className="input-dark w-full px-2 py-1 text-xs"
                  value={filters.githubConnected}
                  onChange={(e) => updateFilters({ githubConnected: e.target.value })}
                >
                  <option value="">All Candidates</option>
                  <option value="true">Linked</option>
                  <option value="false">Not Linked</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="subtle block" htmlFor="lc-connected-select">LeetCode Connected</label>
                <select
                  id="lc-connected-select"
                  className="input-dark w-full px-2 py-1 text-xs"
                  value={filters.leetcodeConnected}
                  onChange={(e) => updateFilters({ leetcodeConnected: e.target.value })}
                >
                  <option value="">All Candidates</option>
                  <option value="true">Linked</option>
                  <option value="false">Not Linked</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="subtle block" htmlFor="cf-connected-select">Codeforces Connected</label>
                <select
                  id="cf-connected-select"
                  className="input-dark w-full px-2 py-1 text-xs"
                  value={filters.codeforcesConnected}
                  onChange={(e) => updateFilters({ codeforcesConnected: e.target.value })}
                >
                  <option value="">All Candidates</option>
                  <option value="true">Linked</option>
                  <option value="false">Not Linked</option>
                </select>
              </div>
            </div>

            {/* Academic details */}
            <div className="space-y-2 pt-1 border-t border-neutral-800">
              <span className="font-bold text-neutral-400 block">Academic Semesters</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="subtle block" htmlFor="semester-filter-select">Semester</label>
                  <select
                    id="semester-filter-select"
                    className="input-dark w-full px-2 py-1"
                    value={filters.semester}
                    onChange={(e) => updateFilters({ semester: e.target.value })}
                  >
                    <option value="">Any</option>
                    {[1,2,3,4,5,6,7,8].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="subtle block" htmlFor="year-filter-select">Study Year</label>
                  <select
                    id="year-filter-select"
                    className="input-dark w-full px-2 py-1"
                    value={filters.year}
                    onChange={(e) => updateFilters({ year: e.target.value })}
                  >
                    <option value="">Any</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Resume Filters */}
            <div className="space-y-2 pt-1 border-t border-neutral-800">
              <span className="font-bold text-neutral-400 block">Resume Intelligence</span>
              
              <div className="space-y-1">
                <label className="subtle block" htmlFor="has-resume-select">Resume Analysis</label>
                <select
                  id="has-resume-select"
                  className="input-dark w-full px-2 py-1"
                  value={filters.hasResumeAnalysis}
                  onChange={(e) => updateFilters({ hasResumeAnalysis: e.target.value })}
                >
                  <option value="">All Candidates</option>
                  <option value="true">Analyzed</option>
                  <option value="false">Unanalyzed</option>
                </select>
              </div>

              {filters.hasResumeAnalysis === 'true' && (
                <div className="space-y-1">
                  <label className="subtle block">Min ATS Score</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0" max="100" step="5"
                      className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                      value={localAtsMin || 0}
                      onChange={(e) => setLocalAtsMin(e.target.value === '0' ? '' : e.target.value)}
                    />
                    <span className="font-bold w-6 text-right">{localAtsMin || 0}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          <button
            onClick={applyRangeFilters}
            className="btn btn-primary w-full text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center cursor-pointer shadow-sm mt-3"
            type="button"
          >
            Apply Filters
          </button>
        </div>

        {/* Right Side: Search and Results table area */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Search form bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3 text-neutral-400" />
              <input
                type="text"
                placeholder="Search candidate name, email, or skills..."
                className="input-dark w-full pl-10 pr-4 py-2 text-sm"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary px-5 text-xs font-semibold rounded-lg cursor-pointer"
              type="submit"
            >
              Search
            </button>
          </form>

          {/* Results Container card */}
          <div className="card overflow-hidden">
            
            {/* Table layout wrapper */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 font-semibold border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <th className="p-3.5 w-[130px] select-none">Name</th>
                    <th className="p-3.5 w-[110px] select-none">Department</th>
                    <th className="p-3.5 w-[65px] select-none">Sem</th>
                    
                    {/* Sortable headers */}
                    <th 
                      onClick={() => handleSort('developerScore')}
                      className="p-3.5 w-[110px] cursor-pointer hover:bg-neutral-900 transition-colors select-none"
                      aria-sort={(filters.sortBy === 'developerScore') ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Dev Score</span>
                        {(filters.sortBy === 'developerScore') ? (
                          filters.sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        ) : null}
                      </div>
                    </th>

                    <th 
                      onClick={() => handleSort('gpa')}
                      className="p-3.5 w-[75px] cursor-pointer hover:bg-neutral-900 transition-colors select-none"
                      aria-sort={(filters.sortBy === 'gpa') ? (filters.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>GPA</span>
                        {(filters.sortBy === 'gpa') ? (
                          filters.sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        ) : null}
                      </div>
                    </th>

                    <th className="p-3.5 w-[70px] select-none">ATS Score</th>
                    <th className="p-3.5 w-[95px] select-none">Connections</th>
                    <th className="p-3.5 w-[140px] select-none">Skills</th>
                    <th className="p-3.5 w-[120px] text-right select-none">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  {loading ? (
                    // Skeleton Table Rows
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="animate-pulse">
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-2/3" /></td>
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-3/4" /></td>
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-1/2" /></td>
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-1/3" /></td>
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-1/3" /></td>
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-1/3" /></td>
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-1/2" /></td>
                        <td className="p-4"><div className="h-3 bg-neutral-800 rounded w-3/4" /></td>
                        <td className="p-4 text-right"><div className="h-6 bg-neutral-800 rounded w-1/2 ml-auto" /></td>
                      </tr>
                    ))
                  ) : error ? (
                    // API Error State
                    <tr>
                      <td colSpan="9" className="p-8 text-center border-none">
                        <div className="flex flex-col items-center justify-center gap-2 text-red-500">
                          <AlertTriangle size={24} />
                          <span className="font-bold text-xs">Search failed: {error}</span>
                        </div>
                      </td>
                    </tr>
                  ) : results.length === 0 ? (
                    // Empty Results State
                    <tr>
                      <td colSpan="9" className="p-8 text-center border-none">
                        <div className="text-neutral-400 flex flex-col items-center justify-center gap-1.5 py-4">
                          <Sliders size={24} />
                          <span className="font-semibold text-xs mt-1">No candidate records match your search criteria.</span>
                          <span className="text-[10px] subtle">Try resetting some filters or queries.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // Valid Results row mapping
                    results.map((row) => {
                      const isShortlisted = shortlistedIds.includes(row._id);
                      return (
                        <tr 
                          key={row._id} 
                          className={`hover:bg-neutral-950/30 transition-colors ${
                            isShortlisted ? 'bg-blue-500/2 border-l border-l-blue-500' : ''
                          }`}
                        >
                          {/* Name (clickable) */}
                          <td className="p-3.5 font-bold text-white truncate">
                            <button 
                              onClick={() => openCandidateDrawer(row._id)}
                              className="hover:underline text-left cursor-pointer truncate w-full"
                              type="button"
                              title={`View details for ${row.name}`}
                            >
                              {row.name}
                            </button>
                          </td>
                          
                          {/* Department */}
                          <td className="p-3.5 text-neutral-300 truncate" title={row.department}>
                            {row.department || '—'}
                          </td>

                          {/* Semester */}
                          <td className="p-3.5 text-neutral-300">{row.semester || '—'}</td>
                          
                          {/* Developer Score pill */}
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getScoreBadgeClass(row.developerScore)}`}>
                              {row.developerScore}
                            </span>
                          </td>

                          {/* GPA */}
                          <td className="p-3.5 text-white font-bold">{row.gpa}</td>
                          
                          {/* ATS Score (nullable ATS contract rule) */}
                          <td className="p-3.5 text-neutral-300">
                            {row.atsScore !== null ? (
                              <span className="font-semibold">{row.atsScore}</span>
                            ) : (
                              <span className="subtle font-medium">N/A</span>
                            )}
                          </td>
                          
                          {/* Connection Flags */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-neutral-400">
                              <Github 
                                size={14} 
                                className={row.githubConnected ? 'text-cyan-400' : 'opacity-20'} 
                                title={row.githubConnected ? 'GitHub connected' : 'GitHub not linked'}
                              />
                              <Activity 
                                size={14} 
                                className={row.leetcodeConnected ? 'text-blue-400' : 'opacity-20'} 
                                title={row.leetcodeConnected ? 'LeetCode connected' : 'LeetCode not linked'}
                              />
                              <Globe 
                                size={14} 
                                className={row.codeforcesConnected ? 'text-orange-400' : 'opacity-20'} 
                                title={row.codeforcesConnected ? 'Codeforces connected' : 'Codeforces not linked'}
                              />
                            </div>
                          </td>
                          
                          {/* Skills tags */}
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                              {(row.skills || []).slice(0, 3).map((sk, idx) => (
                                <span 
                                  key={`table-skill-${sk}-${idx}`}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 truncate max-w-[70px]"
                                >
                                  {sk}
                                </span>
                              ))}
                              {row.skills && row.skills.length > 3 && (
                                <span className="text-[9px] text-neutral-500">+{row.skills.length - 3}</span>
                              )}
                            </div>
                          </td>
                          
                          {/* Actions */}
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              onClick={() => toggleShortlist(row._id)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer inline-flex items-center justify-center ${
                                isShortlisted
                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                  : 'border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white'
                              }`}
                              type="button"
                              title={isShortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
                            >
                              <Star size={14} fill={isShortlisted ? 'var(--warning-color)' : 'none'} />
                            </button>
                            
                            <button
                              onClick={() => openCandidateDrawer(row._id)}
                              className="btn px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer inline-flex"
                              type="button"
                            >
                              View Profile
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && !loading && !error && (
              <div 
                className="flex items-center justify-between p-3.5 bg-neutral-950 border-t text-xs"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="text-neutral-400">
                  Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} records total)
                </div>
                
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => updateFilters({ page: pagination.page - 1 })}
                    className="btn px-3 py-1.5 rounded bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-700 text-white font-semibold cursor-pointer"
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => updateFilters({ page: pagination.page + 1 })}
                    className="btn px-3 py-1.5 rounded bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-700 text-white font-semibold cursor-pointer"
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* Candidate detail slide-over drawer overlay */}
      <CandidateDetailDrawer 
        userId={selectedUserId}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedUserId(null);
        }}
      />

    </div>
  );
}

export default AdminTalentDiscovery;
