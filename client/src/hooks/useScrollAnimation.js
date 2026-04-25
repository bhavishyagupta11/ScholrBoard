import { useEffect, useRef } from 'react';

// Enhanced scroll animation hook with direction support
export const useScrollAnimation = (options = {}) => {
  const elementRef = useRef(null);
  const observerRef = useRef(null);

  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    direction = 'up',
    delay = 0,
    duration = 0.8,
    triggerOnce = true
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Set initial styles based on direction
    const setInitialStyles = () => {
      element.style.opacity = '0';
      element.style.transition = `opacity ${duration}s ease-out, transform ${duration}s ease-out`;
      
      switch (direction) {
        case 'left':
          element.style.transform = 'translateX(-50px)';
          break;
        case 'right':
          element.style.transform = 'translateX(50px)';
          break;
        case 'up':
        default:
          element.style.transform = 'translateY(30px)';
          break;
      }
      
      if (delay > 0) {
        element.style.transitionDelay = `${delay}s`;
      }
    };

    // Set visible styles
    const setVisibleStyles = () => {
      element.style.opacity = '1';
      element.style.transform = 'translate(0)';
    };

    // Initialize styles
    setInitialStyles();

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            requestAnimationFrame(() => {
              setVisibleStyles();
            });
            
            if (triggerOnce) {
              observerRef.current?.unobserve(entry.target);
            }
          } else if (!triggerOnce) {
            requestAnimationFrame(() => {
              setInitialStyles();
            });
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, rootMargin, direction, delay, duration, triggerOnce]);

  return elementRef;
};

// Enhanced staggered animation hook
export const useStaggeredAnimation = (itemCount, baseDelay = 0.2) => {
  const containerRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initialize all items as hidden with staggered delays
    itemRefs.current.forEach((item, index) => {
      if (item) {
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = `opacity 0.8s ease-out, transform 0.8s ease-out`;
        item.style.transitionDelay = `${baseDelay + (index * 0.2)}s`;
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Trigger staggered animations
            itemRefs.current.forEach((item, index) => {
              if (item) {
                setTimeout(() => {
                  item.style.opacity = '1';
                  item.style.transform = 'translateY(0)';
                }, index * 200);
              }
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [itemCount, baseDelay]);

  const setItemRef = (index) => (el) => {
    itemRefs.current[index] = el;
  };

  return { containerRef, setItemRef };
};

// Legacy support for existing animation classes
export const useLegacyScrollAnimation = (options = {}) => {
  const elementRef = useRef(null);
  const observerRef = useRef(null);

  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    animationClass = 'fade-in-up',
    delay = 0,
    triggerOnce = true
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add initial animation class and performance optimizations
    element.classList.add(animationClass, 'gpu-accelerated');
    if (delay > 0) {
      element.style.animationDelay = `${delay}s`;
    }

    // Create intersection observer with performance optimizations
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Use requestAnimationFrame for smooth animations
            requestAnimationFrame(() => {
              entry.target.classList.add('animate');
            });
            
            // Remove observer after animation if triggerOnce is true
            if (triggerOnce) {
              observerRef.current?.unobserve(entry.target);
            }
          } else if (!triggerOnce) {
            requestAnimationFrame(() => {
              entry.target.classList.remove('animate');
            });
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, rootMargin, animationClass, delay, triggerOnce]);

  return elementRef;
};
