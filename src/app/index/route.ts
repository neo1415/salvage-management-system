import { NextResponse } from 'next/server';

export function POST() {
  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      Allow: 'GET, HEAD',
    },
  });
}
