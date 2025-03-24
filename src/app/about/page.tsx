'use client';

import { motion } from 'framer-motion';
import { LiquidChrome } from '@/Backgrounds/LiquidChrome/LiquidChrome';

export default function About() {
  return (
    <main className="min-h-screen text-white pt-24 pb-16 relative">
      <div className="absolute inset-0 -z-10">
        <LiquidChrome
          baseColor={[0.05, 0.05, 0.1]}
          speed={0.2}
          amplitude={0.4}
          frequencyX={2.5}
          frequencyY={1.5}
        />
      </div>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 via-transparent to-purple-900/5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-6xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-200 mb-6">
              About Percevia
            </h1>
            <p className="text-xl text-blue-100/80 max-w-3xl mx-auto leading-relaxed">
              Empowering the visually challenged through innovative AI technology
            </p>
          </motion.div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-12 items-center"
          >
            <div>
              <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200 mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-blue-100/80 leading-relaxed mb-6">
                At Percevia, we're dedicated to transforming the lives of visually challenged individuals through cutting-edge AI technology. Our mission is to enhance independence, confidence, and quality of life by providing real-time object detection and environmental awareness.
              </p>
              <p className="text-lg text-blue-100/80 leading-relaxed">
                We believe that technology should be accessible to everyone, and we're committed to making that vision a reality.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-radial from-blue-500/20 to-transparent blur-2xl"></div>
              <img
                src="/features/hero.jpg"
                alt="Percevia Mission"
                className="rounded-2xl shadow-2xl relative z-10"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 via-transparent to-purple-900/5"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200 mb-6">
              Our Values
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Innovation',
                description: 'Pushing the boundaries of AI technology to create meaningful solutions.',
                icon: '🚀',
              },
              {
                title: 'Accessibility',
                description: 'Making advanced technology available and usable for everyone.',
                icon: '🌟',
              },
              {
                title: 'Impact',
                description: 'Creating real, measurable improvements in people\'s daily lives.',
                icon: '💫',
              },
            ].map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 hover:border-blue-500/30 transition-colors"
              >
                <div className="text-4xl mb-4">{value.icon}</div>
                <h3 className="text-2xl font-bold text-white mb-4">{value.title}</h3>
                <p className="text-blue-100/80">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200 mb-6">
              Our Team
            </h2>
            <p className="text-xl text-blue-100/80 max-w-3xl mx-auto leading-relaxed">
              Meet the passionate individuals behind Percevia
            </p>
          </motion.div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                name: 'Dr. Sarah Chen',
                role: 'Chief Executive Officer',
                image: '/features/hero2.jpeg',
              },
              {
                name: 'Michael Rodriguez',
                role: 'Head of AI Research',
                image: '/features/hero3.jpeg',
              },
              {
                name: 'Emma Thompson',
                role: 'Lead Product Designer',
                image: '/features/hero4.jpeg',
              },
              {
                name: 'David Kim',
                role: 'Technical Director',
                image: '/features/hero.jpg',
              },
            ].map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl">
                  <img
                    src={member.image}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{member.name}</h3>
                <p className="text-blue-100/80">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}