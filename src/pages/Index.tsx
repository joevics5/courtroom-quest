import { motion } from "framer-motion";
import heroImage from "@/assets/hero-courtroom.jpg";
import { Gavel, Scale, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Gavel,
    title: "AI Judge",
    description: "Face a ruthless AI judge who weighs every word. One wrong move and the gavel drops.",
  },
  {
    icon: Scale,
    title: "AI Prosecution",
    description: "Go head-to-head against a relentless AI prosecutor determined to convict your client.",
  },
  {
    icon: Shield,
    title: "You Defend",
    description: "Build your case, cross-examine witnesses, and deliver closing arguments to save the day.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Dark courtroom with dramatic lighting"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-primary font-body text-sm uppercase tracking-[0.3em] mb-6"
          >
            Order in the Court
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="font-display text-6xl md:text-8xl font-black text-foreground leading-[0.95] mb-6"
          >
            Courtroom
            <span className="block text-glow text-primary">Chaos</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10 font-body"
          >
            Defend the innocent against an AI judge and prosecutor.
            Build your case. Sway the jury. Win — or watch your client go down.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-body text-base px-10 py-6 rounded-lg shadow-[var(--shadow-dramatic)] hover:shadow-[var(--glow-gold)] transition-shadow duration-300"
            >
              Enter the Courtroom
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-display text-3xl md:text-5xl font-bold text-center text-foreground mb-16"
          >
            How It <span className="text-primary">Works</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="bg-card border border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors duration-300"
              >
                <div className="w-14 h-14 mx-auto mb-5 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground font-body text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center">
        <p className="text-muted-foreground text-sm font-body">
          © 2026 Courtroom Chaos. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Index;
