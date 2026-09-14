import React from 'react';
import { motion } from 'framer-motion';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Main.css';
const icon = '/suu2.webp';
const icon1 = '/suu1.webp';
const icon2 = '/suu3.webp';

import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../lib/AuthContext';

const Main = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();

  const handleChatNowClick = async () => {
    console.log("Chat button clicked, user:", user);
    if (user) {
      navigate('/chat');
    } else {
      try {
        console.log("Attempting Google login...");
        await loginWithGoogle();
        console.log("Login successful, navigating to chat");
        navigate('/chat');
      } catch (err) {
        console.error("Login Error:", err);
      }
    }
  };


  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "100px" },
    transition: { duration: 0.8, ease: "easeOut" }
  };

  const staggerContainer = {
    initial: {},
    whileInView: { transition: { staggerChildren: 0.2 } }
  };

  return (
    <>
      <section className="main">
        {/* Animated Background Blobs */}
        <div className="blob-container">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>

        {/* First Section */}
        <section className="hero-section">
          <motion.div
            className="container custom-container"
            {...fadeInUp}
          >
            <div className="row align-items-center">
              <div className="col-md-6 order-2 order-md-1">
                <motion.img
                  src={icon}
                  alt="Sayraa AI Assistant"
                  className="img-fluid custom-image"
                  fetchPriority="high"
                  loading="eager"
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div className="col-md-6 order-1 order-md-2 text-center">
                <h1 className="header">
                  <b>Meet</b> <span className="sayraaText">Sayraa</span> — <br />
                  <b>Your AI Guide to Learning, Internships & Careers</b>
                </h1>
                <p className="content-text">Sayraa is your intelligent AI learning companion for courses, skills, internships, projects, and career growth.</p>
                <button className="button-69" role="button" onClick={handleChatNowClick}>
                  <span className="text">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <b>CHAT NOW</b>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Second Section */}
        <section className="hero-section">
          <motion.div
            className="container custom-container"
            {...fadeInUp}
          >
            <div className="row align-items-center">
              <div className="col-md-6 order-1 order-md-1 text-center">
                <h1 className="header">
                  <b>Your</b> <span className="sayraaText">Personalized</span> <br />
                  <b>EduSkill Intelligence</b>
                </h1>
                <p className="content-text">Sayraa is designed to guide your learning journey, recommend skill-building internships, and accelerate your career growth with precise, reliable, and intelligent AI mentorship.</p>
                <button className="button-69" role="button" onClick={handleChatNowClick}>
                  <span className="text">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <b>CHAT NOW</b>
                  </span>
                </button>
              </div>
              <div className="col-md-6 order-2 order-md-2">
                <motion.img
                  src={icon1}
                  alt="Sayraa AI"
                  className="img-fluid custom-image"
                  animate={{ y: [0, 15, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
              </div>
            </div>
          </motion.div>
        </section>

        {/* Third Section */}
        <section className="hero-section">
          <motion.div
            className="container custom-container"
            {...fadeInUp}
          >
            <div className="row align-items-center">
              <div className="col-md-6 order-2 order-md-1">
                <motion.img
                  src={icon2}
                  alt="Intelligent Assistant"
                  className="img-fluid custom-image"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div className="col-md-6 order-1 order-md-2 text-center">
                <h1 className="header">
                  <b>Discover</b> <span className="sayraaText">Learning</span>, <br />
                  <b>Unlock Opportunities</b>
                </h1>
                <p className="content-text">With cutting-edge educational AI, Sayraa empowers you with customized learning roadmaps, curated internship opportunities, and actionable career insights.</p>
                <button className="button-69" role="button" onClick={handleChatNowClick}>
                  <span className="text">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <b>CHAT NOW</b>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Why Choose Section */}
        <div className="feature-section-wrapper">
          <motion.div
            className="container"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            <h2 className="header mb-5">Why Choose Sayraa?</h2>
            <div className="row">
              {[
                { title: "Expert-Led Courses", desc: "Training in Software Testing, Web Development, SAP, AI & more by top MNC mentors." },
                { title: "Real Internships", desc: "AICTE/BPUT-compliant internship programs with live project experience." },
                { title: "Placement Support", desc: "Mock interviews, HR preparation and campus placement assistance." }
              ].map((feature, idx) => (
                <div className="col-md-4" key={idx}>
                  <motion.div
                    className="feature-box"
                    variants={fadeInUp}
                  >
                    <h3>{feature.title}</h3>
                    <p>{feature.desc}</p>
                  </motion.div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default Main;
