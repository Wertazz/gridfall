import { generatePosts } from '@/lib/generate-posts';
import { NextResponse } from 'next/server';

// Route de test sans auth — utilisée par le bouton "Générer posts" en dev
export async function POST() {
  try {
    const result = await generatePosts();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[trigger]', err);
    return NextResponse.json({ error: 'Génération échouée', generated: 0 }, { status: 500 });
  }
}
