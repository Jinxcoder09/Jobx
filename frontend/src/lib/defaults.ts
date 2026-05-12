import type { ResumeData, Theme } from "./types";

export function emptyData(): ResumeData {
  return {
    personal: {
      fullName: "",
      title: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      linkedin: "",
      github: "",
      photoUrl: "",
    },
    summary: "",
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    achievements: [],
    languages: [],
    custom: [],
    sectionOrder: [
      "summary",
      "experience",
      "education",
      "projects",
      "skills",
      "certifications",
      "achievements",
      "languages",
    ],
  };
}

export function defaultTheme(): Theme {
  return {
    fontFamily: "Inter",
    fontSize: 11,
    lineSpacing: 1.4,
    sectionSpacing: 16,
    primaryColor: "#0f172a",
    secondaryColor: "#475569",
    accentColor: "#2563eb",
    layout: "single",
  };
}

export function sampleData(): ResumeData {
  return {
    personal: {
      fullName: "Alex Morgan",
      title: "Senior Product Designer",
      email: "alex@morgan.design",
      phone: "+1 (415) 555-0148",
      location: "San Francisco, CA",
      website: "morgan.design",
      linkedin: "linkedin.com/in/alexmorgan",
      github: "",
      photoUrl: "",
    },
    summary:
      "Product designer with 8+ years shipping consumer software for design-led teams. Partner closely with engineering on systems thinking, prototyping, and shipping at quality.",
    experience: [
      {
        id: "e1",
        company: "Linear",
        role: "Senior Product Designer",
        location: "Remote",
        startDate: "2022",
        endDate: "Present",
        current: true,
        bullets: [
          "Led the redesign of the issue triage flow, lifting weekly active triagers by 38%.",
          "Shipped a cross-platform command bar adopted by 92% of weekly users in 6 weeks.",
          "Hired and onboarded two designers; ran the team's design critique system.",
        ],
      },
      {
        id: "e2",
        company: "Stripe",
        role: "Product Designer",
        location: "San Francisco, CA",
        startDate: "2018",
        endDate: "2022",
        current: false,
        bullets: [
          "Designed the Connect onboarding for 30+ countries, reducing time to first payout by 41%.",
          "Built the dashboard component library used by 60+ engineers.",
        ],
      },
    ],
    education: [
      {
        id: "ed1",
        school: "Carnegie Mellon University",
        degree: "BFA",
        field: "Communication Design",
        location: "Pittsburgh, PA",
        startDate: "2011",
        endDate: "2015",
        gpa: "",
        description: "",
      },
    ],
    projects: [
      {
        id: "p1",
        name: "Type Studio",
        link: "type.studio",
        description: "An indie variable-font playground used by 12k designers monthly.",
        bullets: ["Open-sourced the parser used by 4 design tools."],
        technologies: ["TypeScript", "WebGL", "Rust"],
      },
    ],
    skills: [
      {
        id: "s1",
        category: "Design",
        items: ["Product Design", "Design Systems", "Prototyping", "User Research"],
      },
      {
        id: "s2",
        category: "Tools",
        items: ["Figma", "Linear", "Notion", "GitHub", "Framer"],
      },
    ],
    certifications: [
      { id: "c1", title: "IDEO Designing Strategy", subtitle: "IDEO U", date: "2021", description: "" },
    ],
    achievements: [
      { id: "a1", title: "FWA Site of the Day", subtitle: "type.studio launch", date: "2023", description: "" },
    ],
    languages: [
      { id: "l1", name: "English", level: "Native" },
      { id: "l2", name: "Spanish", level: "Conversational" },
    ],
    custom: [],
    sectionOrder: [
      "summary",
      "experience",
      "education",
      "projects",
      "skills",
      "certifications",
      "achievements",
      "languages",
    ],
  };
}
