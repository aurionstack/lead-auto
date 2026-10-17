import Link from 'next/link';
import BrandMark from './BrandMark';
import LogoutButton from './LogoutButton';

export default function PlatformHeader() {
  return <header className="border-b border-white/[0.06] bg-[#0b0e14]/90"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><div className="flex items-center gap-5"><Link href="/dashboard/lead-recovery"><BrandMark /></Link></div><LogoutButton compact /></div></header>;
}
