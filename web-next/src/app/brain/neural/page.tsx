'use client';

import dynamic from 'next/dynamic';

const NeuralBrain = dynamic(() => import('@/components/NeuralBrain'), { ssr: false });

export default function NeuralPage() {
  return (
    <main className="w-screen h-screen bg-jarvis-dark">
      <NeuralBrain state="idle" />
    </main>
  );
}
