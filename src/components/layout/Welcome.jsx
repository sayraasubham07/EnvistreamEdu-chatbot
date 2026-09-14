import React, { useState, useEffect } from "react";
import Main from "../landing/Main";
import Navbar from './Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';
import Footer from "./Footer";
import { motion, AnimatePresence } from "framer-motion";
import './Welcome.css';

export default function Welcome() {
    return (
        <div style={{ position: 'relative' }}>
            <Navbar />
            <Main />
            <Footer />

        </div>
    );
}
