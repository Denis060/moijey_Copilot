import { Shield, Zap, BookOpen, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      {/* Navigation */}
      <nav className="w-full max-w-7xl px-6 py-8 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
            <span className="text-background font-bold text-xs">M</span>
          </div>
          <span className="font-serif text-2xl tracking-tight text-accent">MOIJEY</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/login" className="hover:text-accent transition-colors">Sign In</Link>
          <Link href="/admin/login" className="px-5 py-2 rounded-full border border-accent/20 hover:bg-accent/5 transition-all text-accent">
            Admin Portal
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl px-6 flex flex-col items-center justify-center text-center space-y-12 py-24">
        {/* Hero Section */}
        <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wider uppercase">
            <Zap className="w-3 h-3" />
            Empowering Excellence
          </div>
          <h1 className="text-5xl md:text-7xl font-serif leading-tight">
            The Intelligence Behind <br />
            <span className="text-accent italic">Every Appointment.</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
            MOIJEY Sales Rep AI Co-Pilot provides real-time, cited answers to complex customer questions,
            ensuring every interaction is backed by verified business knowledge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Link href="/chat" className="px-8 py-4 rounded-full bg-accent text-background font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group">
              Launch Co-Pilot
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full pt-32">
          <FeatureCard
            icon={<BookOpen className="w-6 h-6" />}
            title="Unified Knowledge"
            description="Access proprietary sourcing, policies, and facts in a single, secure interface."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Verified Citations"
            description="Every answer includes sources, document chunks, and internal references for total accuracy."
          />
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6" />}
            title="Real-Time Support"
            description="Designed for high-pressure sales environments where speed and precision matter most."
          />
        </div>
      </main>

      <footer className="w-full max-w-7xl px-6 py-12 border-t border-border mt-32 text-center">
        <p className="text-muted text-sm">
          &copy; {new Date().getFullYear()} MOIJEY. Proprietary System. Unauthorized access is strictly prohibited.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-3xl bg-surface/30 border border-border/50 text-left space-y-4 hover:border-accent/30 transition-all group">
      <div className="w-12 h-12 rounded-2xl bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-background transition-all">
        {icon}
      </div>
      <h3 className="text-xl font-serif font-semibold">{title}</h3>
      <p className="text-muted leading-relaxed">{description}</p>
    </div>
  );
}
