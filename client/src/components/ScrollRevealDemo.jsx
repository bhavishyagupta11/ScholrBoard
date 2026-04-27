import React from 'react';
import { useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import { Sparkles, Zap, Target, Award, Users, BarChart3 } from 'lucide-react';

const ScrollRevealDemo = () => {
  // Staggered animation for multiple cards
  const { containerRef: staggeredContainerRef, setItemRef: setStaggeredRef } = useStaggeredAnimation(6, 0.1);

  const demoCards = [
    {
      title: 'Student Activity Tracker',
      description: 'Log coursework, projects, hackathons, internships, and extracurricular activities with detailed descriptions and evidence uploads.',
      icon: <BarChart3 className="w-8 h-8" />,
      iconBg: 'var(--primary-blue)'
    },
    {
      title: 'Faculty Approval System',
      description: 'Faculty members can review, verify, and approve student submissions with institutional credibility and digital signatures.',
      icon: <Users className="w-8 h-8" />,
      iconBg: 'var(--primary-blue)'
    },
    {
      title: 'Verified Digital Portfolio',
      description: 'Auto-generate professional portfolios with verified achievements, coding profiles, and academic records for job applications.',
      icon: <Award className="w-8 h-8" />,
      iconBg: 'var(--primary-blue)'
    },
    {
      title: 'Coding Platform Integration',
      description: 'Sync LeetCode, CodeChef, HackerRank profiles automatically. Track coding contests, ratings, and problem-solving statistics.',
      icon: <Target className="w-8 h-8" />,
      iconBg: 'var(--primary-blue)'
    },
    {
      title: 'Resume Import & Builder',
      description: 'Import existing resumes, extract achievements, and build comprehensive profiles with verified institutional backing.',
      icon: <Sparkles className="w-8 h-8" />,
      iconBg: 'var(--primary-blue)'
    },
    {
      title: 'Admin Analytics Dashboard',
      description: 'Monitor student success metrics, placement statistics, institutional performance, and generate comprehensive reports.',
      icon: <Zap className="w-8 h-8" />,
      iconBg: 'var(--primary-blue)'
    }
  ];

  return (
    <div className="py-20 space-y-20">
      {/* Staggered Animation Demo */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Core 
            <span className="text-blue-700"> Services</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Explore our comprehensive suite of tools designed to transform student achievement tracking and verification.
          </p>
        </div>

        <div ref={staggeredContainerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoCards.map((card, index) => (
            <div
              key={card.title}
              ref={setStaggeredRef(index)}
              className="group relative overflow-hidden rounded-xl bg-white border border-slate-200 p-6 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-xl"
            >
              <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform duration-300" style={{background:card.iconBg}}>
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">
                  {card.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed transition-colors">
                  {card.description}
                </p>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center text-xs font-medium text-slate-500 group-hover:text-blue-700">
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

    </div>
  );
};

export default ScrollRevealDemo;
