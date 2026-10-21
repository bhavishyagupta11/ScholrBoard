/**
 * phase7LinkedIn.unit.test.js — ScholrBoard V13 Phase 7
 *
 * Unit tests covering:
 *   1. Connected LinkedIn account with unavailable activity metrics (identity only, followers=null).
 *   2. Successful authorized response with verified metrics (where restricted scopes are granted).
 *   3. Missing scopes, expired authorization (401), rate limits (429), timeouts, and provider errors.
 *   4. Unknown versus confirmed-zero values (unavailable is null, never converted to 0).
 *   5. Input normalization (handles, full URLs, company paths, domain validation).
 *   6. Security: access tokens/secrets never leaked in responses or error messages.
 *   7. Zero scoring effect on Developer Score v3 and Placement Readiness v2.
 *   8. Absence of fabricated metrics (never returns 0 for missing metrics, no synthetic linkedInConnected?1:0).
 *   9. Live smoke test helper reports UNVERIFIED when credentials unset.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeLinkedInInput,
  fetchLinkedInProfile,
  verifyLiveLinkedInIntegration,
} from '../../services/providers/linkedinProvider.js';

import {
  NOMINAL_WEIGHTS,
  FORMULA_VERSION as DEV_FORMULA_VERSION,
  SCORE_VERSION as DEV_SCORE_VERSION,
  DEVELOPER_METHODOLOGY_VERSION,
  calculateDeveloperScore,
} from '../../services/developerScoringService.js';

import {
  PLACEMENT_NOMINAL_WEIGHTS,
  PLACEMENT_FORMULA_VERSION,
  PLACEMENT_SCORE_VERSION,
  PLACEMENT_METHODOLOGY_VERSION,
  calculatePlacementScore,
} from '../../services/placementReadinessService.js';

describe('Phase 7.1: Scoring Formula Integrity & Versioning Audit', () => {
  it('Developer Score v3 retains authoritative V13 Part 6 formula weights and versioning', () => {
    assert.equal(DEVELOPER_METHODOLOGY_VERSION, 'v3.0.0');
    assert.equal(DEV_FORMULA_VERSION, 'v3.0.0');
    assert.equal(DEV_SCORE_VERSION, 3);

    // Exact V13 Part 6.2 nominal weights
    assert.strictEqual(NOMINAL_WEIGHTS.dsa, 0.30, 'DSA must be nominal 30%');
    assert.strictEqual(NOMINAL_WEIGHTS.engActivity, 0.25, 'Engineering activity consistency must be nominal 25%');
    assert.strictEqual(NOMINAL_WEIGHTS.repoQuality, 0.20, 'Repository quality must be nominal 20%');
    assert.strictEqual(NOMINAL_WEIGHTS.cp, 0.15, 'Competitive programming must be nominal 15%');
    assert.strictEqual(NOMINAL_WEIGHTS.breadth, 0.10, 'Technical breadth must be nominal 10%');

    // Strict sum to 1.00
    const sum = Object.values(NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-6, `Developer weights must sum to 1.0, got ${sum}`);
    assert.strictEqual(NOMINAL_WEIGHTS.linkedin, undefined, 'LinkedIn must NOT exist in Developer Score weights');
  });

  it('Placement Readiness v2 retains authoritative V13 Part 7 formula weights and versioning', () => {
    assert.equal(PLACEMENT_METHODOLOGY_VERSION, 'v2.0.0');
    assert.equal(PLACEMENT_FORMULA_VERSION, 'v2.0.0');
    assert.equal(PLACEMENT_SCORE_VERSION, 2);

    // Exact V13 Part 7.2 nominal weights
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.placementDsa, 0.28, 'Placement DSA prep must be nominal 28%');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.resumeReadiness, 0.22, 'Resume readiness must be nominal 22%');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.portfolio, 0.17, 'Portfolio must be nominal 17%');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.academic, 0.17, 'Academic must be nominal 17%');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.achievements, 0.11, 'Achievements must be nominal 11%');
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.completeness, 0.05, 'Completeness must be nominal 5%');

    // Strict sum to 1.00
    const sum = Object.values(PLACEMENT_NOMINAL_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 1e-6, `Placement weights must sum to 1.0, got ${sum}`);
    assert.strictEqual(PLACEMENT_NOMINAL_WEIGHTS.linkedin, undefined, 'LinkedIn must NOT exist in Placement Readiness weights');
  });
});

describe('Phase 7.2: LinkedIn Input Normalization & Identity Semantics', () => {
  it('normalizes a standard username handle to canonical HTTPS URL and vanity', () => {
    const res = normalizeLinkedInInput('johndoe');
    assert.equal(res.vanityName, 'johndoe');
    assert.equal(res.profileUrl, 'https://www.linkedin.com/in/johndoe');
  });

  it('strips leading @ symbol and trailing slashes from handles', () => {
    const res = normalizeLinkedInInput('@jane_developer/');
    assert.equal(res.vanityName, 'jane_developer');
    assert.equal(res.profileUrl, 'https://www.linkedin.com/in/jane_developer');
  });

  it('normalizes full URLs with various subdomains and trailing slashes', () => {
    const u1 = normalizeLinkedInInput('https://linkedin.com/in/alicesmith/');
    assert.equal(u1.vanityName, 'alicesmith');
    assert.equal(u1.profileUrl, 'https://www.linkedin.com/in/alicesmith');

    const u2 = normalizeLinkedInInput('https://www.linkedin.com/in/bobs-profile-123?trk=public_profile');
    assert.equal(u2.vanityName, 'bobs-profile-123');
    assert.equal(u2.profileUrl, 'https://www.linkedin.com/in/bobs-profile-123');
  });

  it('rejects non-linkedin URLs and empty or malformed inputs', () => {
    assert.throws(() => normalizeLinkedInInput(''), /required/i);
    assert.throws(() => normalizeLinkedInInput('   '), /required/i);
    assert.throws(() => normalizeLinkedInInput(null), /required/i);
    assert.throws(() => normalizeLinkedInInput('https://twitter.com/johndoe'), /Expected linkedin\.com/i);
    assert.throws(() => normalizeLinkedInInput('a'), /at least 2 characters/i);
  });
});

describe('Phase 7.3: Approved Scope vs Restricted Activity Metrics (Missing Data Semantics)', () => {
  it('returns valid identity but null followers/connections under approved basic scopes', async () => {
    const mockFetch = async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        sub: 'li_sub_98765',
        name: 'John Developer',
        given_name: 'John',
        family_name: 'Developer',
        vanityName: 'johndev',
      }),
    });

    const result = await fetchLinkedInProfile('mock-token-xyz', {
      fetchImpl: mockFetch,
      scopes: ['openid', 'profile', 'email'],
    });

    assert.equal(result.memberId, 'li_sub_98765');
    assert.equal(result.vanityName, 'johndev');
    assert.equal(result.profileUrl, 'https://www.linkedin.com/in/johndev');
    assert.equal(result.activityMetricsAvailable, false);
    assert.equal(result.followers, null, 'Followers must be strictly null under basic scopes');
    assert.equal(result.connections, null, 'Connections must be strictly null under basic scopes');
    assert.equal(result.isPartial, true);
    assert.match(result.reason, /Activity and engagement metrics unavailable/i);
  });

  it('distinguishes unknown from confirmed-zero: missing activity metrics are null, not 0', async () => {
    const mockFetch = async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        sub: 'li_sub_123',
        name: 'Jane Coder',
      }),
    });

    const result = await fetchLinkedInProfile('valid-token', { fetchImpl: mockFetch });
    assert.strictEqual(result.followers, null);
    assert.notStrictEqual(result.followers, 0);
    assert.strictEqual(result.connections, null);
    assert.notStrictEqual(result.connections, 0);
  });

  it('populates verified metrics when restricted social scope is granted and returned by provider', async () => {
    const mockFetch = async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        sub: 'li_enterprise_456',
        vanityName: 'techlead',
        followers: 1250,
        connections: 500,
      }),
    });

    const result = await fetchLinkedInProfile('enterprise-token', {
      fetchImpl: mockFetch,
      scopes: ['openid', 'profile', 'r_organization_social'],
    });

    assert.equal(result.activityMetricsAvailable, true);
    assert.equal(result.followers, 1250);
    assert.equal(result.connections, 500);
    assert.equal(result.isPartial, false);
    assert.equal(result.reason, null);
  });
});

describe('Phase 7.4: Error and Security Handling', () => {
  it('handles expired authorization (401) with AUTH_EXPIRED error code', async () => {
    const mockFetch = async () => ({
      status: 401,
      ok: false,
    });

    await assert.rejects(
      async () => fetchLinkedInProfile('expired-token', { fetchImpl: mockFetch }),
      (err) => {
        assert.equal(err.code, 'AUTH_EXPIRED');
        assert.equal(err.statusCode, 401);
        assert.doesNotMatch(err.message, /expired-token/, 'Token must never be leaked in error message');
        return true;
      }
    );
  });

  it('handles insufficient scopes (403) with INSUFFICIENT_SCOPE error code', async () => {
    const mockFetch = async () => ({
      status: 403,
      ok: false,
    });

    await assert.rejects(
      async () => fetchLinkedInProfile('scoped-token', { fetchImpl: mockFetch }),
      (err) => {
        assert.equal(err.code, 'INSUFFICIENT_SCOPE');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  it('handles provider rate limits (429) with RATE_LIMITED error code', async () => {
    const mockFetch = async () => ({
      status: 429,
      ok: false,
    });

    await assert.rejects(
      async () => fetchLinkedInProfile('valid-token', { fetchImpl: mockFetch }),
      (err) => {
        assert.equal(err.code, 'RATE_LIMITED');
        assert.equal(err.statusCode, 429);
        return true;
      }
    );
  });

  it('handles request timeout using AbortController with TIMEOUT error code', async () => {
    const mockFetch = async (url, opts) => {
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          const abortErr = new Error('The operation was aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    };

    await assert.rejects(
      async () => fetchLinkedInProfile('valid-token', { fetchImpl: mockFetch, timeoutMs: 20 }),
      (err) => {
        assert.equal(err.code, 'TIMEOUT');
        assert.equal(err.statusCode, 504);
        return true;
      }
    );
  });
});

describe('Phase 7.5: Genuine Scoring Invariance Across All 6 Profile States', () => {
  // Underlying profile with rich non-LinkedIn verified evidence
  const baseCandidateProfile = {
    gpa: 8.75,
    gpaScale: 10.0,
    bio: 'Software engineer passionate about scalable backend architecture, distributed databases, and high-performance APIs.',
    skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'MongoDB'],
    projects: [{ title: 'Fullstack Platform', description: 'Enterprise collaboration dashboard built with Node.js and MongoDB' }],
    education: [{ institution: 'National Institute of Technology', degree: 'B.Tech CS' }],
    resumeUrl: 'https://res.cloudinary.com/demo/image/upload/sample_resume.pdf',
    careerGoal: 'Cloud Platform Architect',
    achievementPoints: 350,
    achievements: [{ title: 'State Coding Championship Top 10' }],
    codingStats: {
      githubContributions: 240,
      githubRepos: 12,
      githubFollowers: 18,
      leetcodeProblemsSolved: 150,
      leetcodeEasySolved: 60,
      leetcodeMediumSolved: 75,
      leetcodeHardSolved: 15,
      rawMetrics: {
        github: {
          publicRepos: 12,
          effectiveRepositoryCount: 12,
          followers: 18,
          stars: 25,
          forks: 6,
        },
        leetcode: {
          totalSolved: 150,
          easySolved: 60,
          mediumSolved: 75,
          hardSolved: 15,
          activeSubmitDays30d: 12,
          activeSubmitDays90d: 35,
          activeSubmitDays365d: 120,
        },
      },
    },
  };

  // State 1: LinkedIn URL absent
  const state1_absent = JSON.parse(JSON.stringify(baseCandidateProfile));

  // State 2: User-provided LinkedIn URL linked (user-provided reference, identity unverified)
  const state2_userProvidedLinked = {
    ...JSON.parse(JSON.stringify(baseCandidateProfile)),
    socialLinks: { linkedin: 'https://www.linkedin.com/in/alex-engineer' },
    codingStats: {
      ...baseCandidateProfile.codingStats,
      linkedInConnected: true,
      profiles: { linkedin: 'alex-engineer' },
      rawMetrics: {
        ...baseCandidateProfile.codingStats.rawMetrics,
        linkedin: {
          profileUrl: 'https://www.linkedin.com/in/alex-engineer',
          vanityName: 'alex-engineer',
          memberId: null,
          identityVerified: false,
          followers: null,
          connections: null,
          activityMetricsAvailable: false,
          reason: 'User-provided profile reference. OAuth identity verification and activity metrics are unavailable.',
        },
      },
    },
    platformSyncStates: {
      linkedin: {
        connectionStatus: 'LINKED',
        syncStatus: 'UNAVAILABLE',
        lastVerifiedAt: null,
      },
    },
  };

  // State 3: LinkedIn identity or metrics unavailable
  const state3_metricsUnavailable = {
    ...JSON.parse(JSON.stringify(state2_userProvidedLinked)),
    platformSyncStates: {
      linkedin: {
        connectionStatus: 'LINKED',
        syncStatus: 'UNAVAILABLE',
        error: 'Activity and engagement metrics unavailable under current approved permissions',
      },
    },
    codingStats: {
      ...state2_userProvidedLinked.codingStats,
      rawMetrics: {
        ...state2_userProvidedLinked.codingStats.rawMetrics,
        linkedin: {
          ...state2_userProvidedLinked.codingStats.rawMetrics.linkedin,
          followers: null,
          connections: null,
          activityMetricsAvailable: false,
        },
      },
    },
  };

  // State 4: Authorized basic-profile lookup successful (identity verified via OAuth, metrics unavailable)
  const state4_authorizedBasic = {
    ...JSON.parse(JSON.stringify(state2_userProvidedLinked)),
    platformSyncStates: {
      linkedin: {
        connectionStatus: 'LINKED',
        syncStatus: 'PARTIAL',
        lastVerifiedAt: new Date('2026-10-14T00:00:00Z'),
        lastSuccessfulSync: null,
      },
    },
    codingStats: {
      ...state2_userProvidedLinked.codingStats,
      rawMetrics: {
        ...state2_userProvidedLinked.codingStats.rawMetrics,
        linkedin: {
          profileUrl: 'https://www.linkedin.com/in/alex-engineer',
          vanityName: 'alex-engineer',
          memberId: 'li_sub_alex123',
          identityVerified: true,
          followers: null,
          connections: null,
          activityMetricsAvailable: false,
          reason: 'OAuth identity verified. Activity metrics unavailable under current approved permissions.',
        },
      },
    },
  };

  // State 5: LinkedIn synchronization failed, rate-limited, or unauthorized
  const state5a_syncFailed = {
    ...JSON.parse(JSON.stringify(state2_userProvidedLinked)),
    platformSyncStates: {
      linkedin: {
        connectionStatus: 'LINKED',
        syncStatus: 'ERROR',
        error: 'LinkedIn provider returned HTTP 500',
        consecutiveFailures: 2,
      },
    },
  };

  const state5b_rateLimited = {
    ...JSON.parse(JSON.stringify(state2_userProvidedLinked)),
    platformSyncStates: {
      linkedin: {
        connectionStatus: 'LINKED',
        syncStatus: 'RATE_LIMITED',
        error: 'LinkedIn API rate limit exceeded',
      },
    },
  };

  const state5c_authExpired = {
    ...JSON.parse(JSON.stringify(state2_userProvidedLinked)),
    platformSyncStates: {
      linkedin: {
        connectionStatus: 'LINKED',
        syncStatus: 'AUTH_EXPIRED',
        error: 'LinkedIn authorization expired or token is invalid',
      },
    },
  };

  // State 6: LinkedIn profile unlinked
  const state6_unlinked = {
    ...JSON.parse(JSON.stringify(baseCandidateProfile)),
    socialLinks: { linkedin: undefined },
    codingStats: {
      ...baseCandidateProfile.codingStats,
      linkedInConnected: false,
      profiles: { linkedin: undefined },
      rawMetrics: {
        ...baseCandidateProfile.codingStats.rawMetrics,
        linkedin: undefined,
      },
    },
    platformSyncStates: {
      linkedin: {
        connectionStatus: 'UNLINKED',
        syncStatus: 'NOT_CONNECTED',
      },
    },
  };

  const states = [
    { name: 'State 1: LinkedIn URL absent', profile: state1_absent },
    { name: 'State 2: User-provided LinkedIn URL linked (unverified reference)', profile: state2_userProvidedLinked },
    { name: 'State 3: LinkedIn identity or metrics unavailable', profile: state3_metricsUnavailable },
    { name: 'State 4: Authorized basic-profile lookup successful (identity verified)', profile: state4_authorizedBasic },
    { name: 'State 5a: Synchronization failed (500)', profile: state5a_syncFailed },
    { name: 'State 5b: Synchronization rate-limited (429)', profile: state5b_rateLimited },
    { name: 'State 5c: Synchronization unauthorized (401)', profile: state5c_authExpired },
    { name: 'State 6: LinkedIn profile unlinked', profile: state6_unlinked },
  ];

  it('Developer Score v3 is mathematically and byte-for-byte invariant across all 6 LinkedIn states', () => {
    const baseline = calculateDeveloperScore(state1_absent);

    for (const { name, profile } of states) {
      const result = calculateDeveloperScore(profile);

      // Core score, coverage, confidence, freshness
      assert.strictEqual(result.score, baseline.score, `${name} must have identical score`);
      assert.strictEqual(result.coverage, baseline.coverage, `${name} must have identical coverage`);
      assert.strictEqual(result.confidence, baseline.confidence, `${name} must have identical confidence`);
      assert.strictEqual(result.freshness, baseline.freshness, `${name} must have identical freshness`);
      assert.strictEqual(result.evidenceCount, baseline.evidenceCount, `${name} must have identical evidenceCount`);

      // Fingerprint and hashes
      assert.strictEqual(result.evidenceFingerprint, baseline.evidenceFingerprint, `${name} must have identical evidenceFingerprint`);
      assert.strictEqual(result.snapshotHash, baseline.snapshotHash, `${name} must have identical snapshotHash`);
      assert.strictEqual(result.configSnapshotHash, baseline.configSnapshotHash, `${name} must have identical configSnapshotHash`);

      // Dimension breakdown scores
      assert.deepStrictEqual(result.breakdown, baseline.breakdown, `${name} must have identical breakdown scores`);

      // Dimensions
      for (const [dimKey, dimVal] of baseline.dimensions.entries()) {
        const testDim = result.dimensions.get(dimKey);
        assert.ok(testDim, `${name} missing dimension ${dimKey}`);
        assert.strictEqual(testDim.score, dimVal.score, `${name} dimension ${dimKey} score changed`);
        assert.strictEqual(testDim.effectiveWeight, dimVal.effectiveWeight, `${name} dimension ${dimKey} weight changed`);
      }
    }
  });

  it('Placement Readiness v2 is mathematically and byte-for-byte invariant across all 6 LinkedIn states', () => {
    const baseline = calculatePlacementScore(state1_absent);

    for (const { name, profile } of states) {
      const result = calculatePlacementScore(profile);

      // Core score, coverage, confidence, freshness
      assert.strictEqual(result.score, baseline.score, `${name} must have identical Placement score`);
      assert.strictEqual(result.coverage, baseline.coverage, `${name} must have identical Placement coverage`);
      assert.strictEqual(result.confidence, baseline.confidence, `${name} must have identical Placement confidence`);
      assert.strictEqual(result.freshness, baseline.freshness, `${name} must have identical Placement freshness`);

      // Hashes
      assert.strictEqual(result.snapshotHash, baseline.snapshotHash, `${name} must have identical snapshotHash`);
      assert.strictEqual(result.configSnapshotHash, baseline.configSnapshotHash, `${name} must have identical configSnapshotHash`);

      // Dimension records
      for (const [dimKey, dimVal] of Object.entries(baseline.dimensionRecords)) {
        const testDim = result.dimensionRecords[dimKey];
        assert.ok(testDim, `${name} missing dimension ${dimKey}`);
        assert.strictEqual(testDim.score, dimVal.score, `${name} dimension ${dimKey} score changed`);
        assert.strictEqual(testDim.effectiveWeight, dimVal.effectiveWeight, `${name} dimension ${dimKey} weight changed`);
      }
    }
  });

  it('live smoke test returns UNVERIFIED with clear reason when credentials unset', async () => {
    const report = await verifyLiveLinkedInIntegration({ env: {} });
    assert.equal(report.status, 'UNVERIFIED');
    assert.equal(report.verified, false);
    assert.match(report.reason, /No LinkedIn credentials/i);
  });
});
