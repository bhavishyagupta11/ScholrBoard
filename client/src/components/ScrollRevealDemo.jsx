import React from 'react';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import { Sparkles, Zap, Target, Award, Users, BarChart3 } from 'lucide-react';

const ScrollRevealDemo = () => {
  // Individual direction animations
  const leftCardRef = useScrollAnimation({ direction: 'left', delay: 0.1 });
  const rightCardRef = useScrollAnimation({ direction: 'right', delay: 0.2 });
  const upCardRef = useScrollAnimation({ direction: 'up', delay: 0.3 });

  // Staggered animation for multiple cards
  const { containerRef: staggeredContainerRef, setItemRef: setStaggeredRef } = useStaggeredAnimation(6, 0.1);

  const demoCards = [
    {
      title: 'Student Activity Tracker',
      description: 'Log coursework, projects, hackathons, internships, and extracurricular activities with detailed descriptions and evidence uploads.',
      icon: <BarChart3 className="w-8 h-8" />,
      gradient: 'from-blue-500 to-cyan-500',
      hoverGradient: 'from-blue-400 to-cyan-400'
    },
    {
      title: 'Faculty Approval System',
      description: 'Faculty members can review, verify, and approve student submissions with institutional credibility and digital signatures.',
      icon: <Users className="w-8 h-8" />,
      gradient: 'from-purple-500 to-pink-500',
      hoverGradient: 'from-purple-400 to-pink-400'
    },
    {
      title: 'Verified Digital Portfolio',
      description: 'Auto-generate professional portfolios with verified achievements, coding profiles, and academic records for job applications.',
      icon: <Award className="w-8 h-8" />,
      gradient: 'from-green-500 to-emerald-500',
      hoverGradient: 'from-green-400 to-emerald-400'
    },
    {
      title: 'Coding Platform Integration',
      description: 'Sync LeetCode, CodeChef, HackerRank profiles automatically. Track coding contests, ratings, and problem-solving statistics.',
      icon: <Target className="w-8 h-8" />,
      gradient: 'from-orange-500 to-red-500',
      hoverGradient: 'from-orange-400 to-red-400'
    },
    {
      title: 'Resume Import & Builder',
      description: 'Import existing resumes, extract achievements, and build comprehensive profiles with verified institutional backing.',
      icon: <Sparkles className="w-8 h-8" />,
      gradient: 'from-indigo-500 to-purple-500',
      hoverGradient: 'from-indigo-400 to-purple-400'
    },
    {
      title: 'Admin Analytics Dashboard',
      description: 'Monitor student success metrics, placement statistics, institutional performance, and generate comprehensive reports.',
      icon: <Zap className="w-8 h-8" />,
      gradient: 'from-teal-500 to-cyan-500',
      hoverGradient: 'from-teal-400 to-cyan-400'
    }
  ];

  return (
    <div className="py-20 space-y-20">
      {/* Hero Section with Direction Animations */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            CODEVENGERS 
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Platform Features</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Discover the comprehensive features that make CODEVENGERS the ultimate student achievement platform.
          </p>
        </div>

        {/* Direction Demo Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div 
            ref={leftCardRef}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 p-8 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/25"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Student Dashboard</h3>
              <p className="text-gray-300 leading-relaxed">
                Comprehensive activity tracking, achievement logging, and progress monitoring for students throughout their academic journey.
              </p>
            </div>
          </div>

          <div 
            ref={upCardRef}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 p-8 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/25"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Faculty Verification</h3>
              <p className="text-gray-300 leading-relaxed">
                Streamlined approval workflow for faculty to verify student achievements with institutional credibility and digital signatures.
              </p>
            </div>
          </div>

          <div 
            ref={rightCardRef}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 p-8 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/25"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300">
                <Target className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Digital Portfolio</h3>
              <p className="text-gray-300 leading-relaxed">
                Auto-generate professional portfolios with verified achievements, coding profiles, and academic records for job applications and higher education.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Staggered Animation Demo */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Core 
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Services</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Explore our comprehensive suite of tools designed to transform student achievement tracking and verification.
          </p>
        </div>

        <div ref={staggeredContainerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoCards.map((card, index) => (
            <div
              key={card.title}
              ref={setStaggeredRef(index)}
              className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 p-6 hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-gray-500/25"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gray-100 transition-colors">
                  {card.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors">
                  {card.description}
                </p>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center text-xs font-medium text-gray-400 group-hover:text-gray-300">
                    <span>Learn more</span>
                    <svg className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Performance Features */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Enterprise 
            <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent"> Features</span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Advanced capabilities designed for institutions, faculty, and enterprise-level student management.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: 'Real-time Verification', desc: 'Instant faculty approval system with digital signatures', icon: '⚡' },
            { title: 'Multi-platform Sync', desc: 'Automatic integration with coding platforms and LMS', icon: '🚀' },
            { title: 'Smart Analytics', desc: 'AI-powered insights for student success tracking', icon: '✨' },
            { title: 'Secure & Compliant', desc: 'GDPR compliant with enterprise-grade security', icon: '♿' }
          ].map((feature, index) => (
            <div
              key={feature.title}
              ref={setStaggeredRef(index)}
              className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-800/30 to-gray-900/30 border border-gray-700/30 p-6 hover:scale-105 transition-all duration-300 text-center"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-gray-100 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm group-hover:text-gray-300 transition-colors">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ScrollRevealDemo;
