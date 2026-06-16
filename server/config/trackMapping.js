/**
 * trackMapping.js — Centralized mapping from student departments to career tracks.
 */

export const TRACK_DEPARTMENT_MAPPING = {
  software_engineering: [
    'CSE', 'IT', 'AI', 'AIML', 'AIDS', 'DATA SCIENCE',
    'CYBER SECURITY', 'CLOUD COMPUTING', 'COMPUTER ENGINEERING', 'SOFTWARE ENGINEERING'
  ],
  core_engineering: [
    'ECE', 'EEE', 'EE', 'MECHANICAL', 'CIVIL', 'CHEMICAL', 'BIOTECH',
    'PRODUCTION', 'AUTOMOBILE', 'AEROSPACE', 'INSTRUMENTATION', 'METALLURGY'
  ]
};

/**
 * Helper to resolve track slug/code from a department string.
 * Defaults to 'core_engineering' if no match is found.
 */
export const getTrackCodeForDepartment = (department) => {
  if (!department) return 'core_engineering';
  
  const deptUpper = department.trim().toUpperCase();
  
  for (const [trackCode, depts] of Object.entries(TRACK_DEPARTMENT_MAPPING)) {
    if (depts.includes(deptUpper) || depts.some(d => deptUpper.includes(d))) {
      return trackCode;
    }
  }
  
  return 'core_engineering';
};
