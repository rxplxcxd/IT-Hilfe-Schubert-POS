import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termin buchen | IT-Hilfe Schubert',
  description: 'Buchen Sie online einen Termin für IT-Service bei IT-Hilfe Schubert.',
};

export default function TerminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.3); }
          50% { box-shadow: 0 0 20px 4px rgba(37, 99, 235, 0.15); }
        }
        .anim-fade-up { animation: fadeInUp 0.5s ease-out both; }
        .anim-fade-up-d1 { animation: fadeInUp 0.5s ease-out 0.1s both; }
        .anim-fade-up-d2 { animation: fadeInUp 0.5s ease-out 0.2s both; }
        .anim-fade-up-d3 { animation: fadeInUp 0.5s ease-out 0.3s both; }
        .anim-fade-up-d4 { animation: fadeInUp 0.5s ease-out 0.4s both; }
        .anim-fade-in { animation: fadeIn 0.4s ease-out both; }
        .anim-scale-in { animation: scaleIn 0.4s ease-out both; }
        .anim-slide-down { animation: slideDown 0.3s ease-out both; }
        .anim-pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
        .anim-slot { animation: scaleIn 0.3s ease-out both; }
      `}</style>
      {children}
    </div>
  );
}
