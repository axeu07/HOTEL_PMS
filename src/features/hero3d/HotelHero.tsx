/**
 * Public landing hero: floating navigation, headline and CTAs over the 3D hotel.
 * This file holds no three.js: the poster renders immediately, the WebGL chunk
 * loads behind it, and the poster stays in place wherever 3D is not appropriate.
 */
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '@/app/providers';
import { BrandMark, Icon } from '@/components/icons';
import { detectHeroTier, reducedMotionQuery, type HeroTier } from './capabilities';
import { createRig } from './rig';
import './hero3d.css';

gsap.registerPlugin(ScrollTrigger);

const HotelScene = lazy(() => import('./HotelScene'));
const POSTER_URL = `${import.meta.env.BASE_URL}images/hotel-hero.webp`;

const STORY_CHAPTERS = 8;

function FloatingNav({ condensed }: { condensed: boolean }) {
  const { user } = useAuth();
  return (
    <nav className={`h3d-nav${condensed ? ' is-condensed' : ''}`} aria-label="Site">
      <a href="#top" className="h3d-brand" aria-label="Folio, back to top">
        <BrandMark size={22} />
        <span>Folio</span>
      </a>
      <div className="h3d-nav-links">
        <a href="#about">The hotel</a>
        <a href="#rooms">Rooms</a>
        <a href="#amenities">Facilities</a>
        <a href="#gallery">Gallery</a>
        <a href="#visit">Visit</a>
      </div>
      {user ? (
        <Link to="/app/dashboard" className="h3d-nav-cta">Back to the suite</Link>
      ) : (
        <Link to="/login" className="h3d-nav-cta">Demo login</Link>
      )}
    </nav>
  );
}

export function HotelHero() {
  const { user } = useAuth();
  const heroRef = useRef<HTMLElement>(null);
  const rig = useMemo(createRig, []);
  const [tier, setTier] = useState<HeroTier>(detectHeroTier);
  const [sceneReady, setSceneReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [condensed, setCondensed] = useState(false);

  const animated = !reducedMotionQuery().matches;

  // Rendering stops when nobody can see it: tab hidden, or hero scrolled away.
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    if (heroRef.current) observer.observe(heroRef.current);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, []);

  // Honour a reduced-motion preference even if it is switched on mid-visit.
  useEffect(() => {
    const query = reducedMotionQuery();
    const onChange = () => {
      if (query.matches) setTier('static');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Opening sequence and scroll scrub.
  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    if (!animated) {
      rig.intro = 1;
      return;
    }
    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from('.h3d-line > span', { yPercent: 112, duration: 1.5, stagger: 0.12 }, 0.25)
        .from('.h3d-eyebrow', { autoAlpha: 0, y: 12, duration: 1 }, 0.45)
        .from('.h3d-foot-item', { autoAlpha: 0, y: 18, duration: 1.1, stagger: 0.08 }, 0.75)
        .from(document.querySelector('.h3d-nav'), { autoAlpha: 0, y: -18, duration: 1.1 }, 0.5);

      gsap.to(rig, { intro: 1, duration: 4.2, ease: 'power2.out' });

      gsap
        .timeline({
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
            onUpdate: (self) => {
              rig.scroll = self.progress;
            },
          },
        })
        .to('.h3d-title-block', { y: -90, autoAlpha: 0, ease: 'none', duration: 0.5 }, 0)
        .to('.h3d-foot', { y: 40, autoAlpha: 0, ease: 'none', duration: 0.35 }, 0)
        .to('.h3d-stage', { yPercent: 14, ease: 'none', duration: 1 }, 0);
    }, hero);
    return () => context.revert();
  }, [animated, rig]);

  // Cursor drives the camera (through the rig) and a touch of type parallax.
  useEffect(() => {
    if (!animated || !window.matchMedia('(pointer: fine)').matches) return;
    const hero = heroRef.current;
    if (!hero) return;
    const titleX = gsap.quickTo(hero.querySelector('.h3d-title'), 'x', { duration: 1.1, ease: 'power3.out' });
    const titleY = gsap.quickTo(hero.querySelector('.h3d-title'), 'y', { duration: 1.1, ease: 'power3.out' });
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -((event.clientY / window.innerHeight) * 2 - 1);
      rig.pointerX = x;
      rig.pointerY = y;
      titleX(x * -9);
      titleY(y * 5);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [animated, rig]);

  const degrade = () => {
    setTier('static');
    setSceneReady(false);
  };

  return (
    <>
      <FloatingNav condensed={condensed} />
      <header id="top" ref={heroRef} className="h3d">
        <div className="h3d-stage" role="img" aria-label="A fictional resort hotel at dusk, with terraced balconies, palm trees and a lit swimming pool in front of the entrance.">
          <img className="h3d-poster" src={POSTER_URL} alt="" decoding="async" />
          {tier !== 'static' && (
            <div className={`h3d-canvas${sceneReady ? ' is-ready' : ''}`}>
              <Suspense fallback={null}>
                <HotelScene tier={tier} rig={rig} active={onScreen && pageVisible} onReady={() => setSceneReady(true)} onFailed={degrade} />
              </Suspense>
            </div>
          )}
        </div>
        <div className="h3d-scrim" />

        <div className="h3d-copy">
          <div className="h3d-title-block">
            <p className="h3d-eyebrow">Hotel management platform</p>
            <h1 className="h3d-title">
              <span className="h3d-line"><span>Hospitality,</span></span>{' '}
              <span className="h3d-line"><span><em>Reimagined.</em></span></span>
            </h1>
          </div>

          <div className="h3d-foot">
            <div className="h3d-foot-copy h3d-foot-item">
              <p className="h3d-sub">One intelligent platform to manage every stay, every room and every guest experience.</p>
              <p className="h3d-disclosure">
                A product demonstration with a fictional hotel. <a href="#demo">See the sample logins</a>
              </p>
            </div>
            <div className="h3d-foot-end h3d-foot-item">
              <div className="h3d-chapter" aria-hidden="true">
                <span className="h3d-chapter-count"><b>01</b> / {String(STORY_CHAPTERS).padStart(2, '0')}</span>
                <span className="h3d-chapter-ticks">
                  {Array.from({ length: STORY_CHAPTERS }, (_, i) => <i key={i} className={i === 0 ? 'on' : ''} />)}
                </span>
                <span className="h3d-chapter-name">Hotel exterior</span>
              </div>
              <div className="h3d-actions">
                <a href="#about" className="h3d-btn">Explore the Platform</a>
                {user ? (
                  <Link to="/app/dashboard" className="h3d-btn h3d-btn-primary">
                    Launch Live Demo <Icon name="arrow" size={17} />
                  </Link>
                ) : (
                  <a href="#demo" className="h3d-btn h3d-btn-primary">
                    Launch Live Demo <Icon name="arrow" size={17} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
