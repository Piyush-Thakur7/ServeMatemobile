const CORE_CAUSES = [
  {
    category: "trees",
    title: "Trees / Environment",
    description: "Environmental restoration causes for tree plantation, survival proof, and verified green drives.",
    icon: "\u{1F333}",
    impactPerRupee: "Verified green impact",
    visual: "environment",
    emptyState: "New verified causes coming soon",
  },
  {
    category: "meals",
    title: "Meals / Hunger Relief",
    description: "Food security campaigns for nutritious meals, community kitchens, and hunger relief support.",
    icon: "\u{1F35B}",
    impactPerRupee: "Verified meal support",
    visual: "meals",
    emptyState: "No community activity yet",
  },
  {
    category: "essentials",
    title: "Essentials / Emergency Support",
    description: "Emergency kits, hygiene essentials, and immediate relief for families facing crisis.",
    icon: "\u{1F9F0}",
    impactPerRupee: "Verified relief support",
    visual: "essentials",
    emptyState: "Be the first supporter",
  },
  {
    category: "ngo-support",
    title: "NGO Community Support",
    description: "Support verified NGOs with tools, volunteers, proof uploads, and operational resilience.",
    icon: "\u{1F91D}",
    impactPerRupee: "Verified NGO support",
    visual: "ngo",
    emptyState: "New verified causes coming soon",
  },
];

function mergeCoreCauses(realCauses = []) {
  const byCategory = new Map(realCauses.map((cause) => [cause.category, cause]));

  return CORE_CAUSES.map((core) => {
    const real = byCategory.get(core.category);
    if (!real) {
      return {
        ...core,
        id: core.category,
        _id: core.category,
        isPlaceholder: true,
        active: true,
        raised: 0,
        goal: 0,
        hasRealActivity: false,
      };
    }

    const plain = typeof real.toObject === "function" ? real.toObject() : real;
    const raised = Number(plain.raised || 0);
    const contributors = Number(plain.contributors || 0);

    return {
      ...core,
      ...plain,
      title: plain.title || core.title,
      description: plain.description || core.description,
      icon: plain.icon || core.icon,
      impactPerRupee: plain.impactPerRupee || core.impactPerRupee,
      isPlaceholder: false,
      hasRealActivity: raised > 0 || contributors > 0,
      visual: core.visual,
      emptyState: core.emptyState,
    };
  });
}

module.exports = {
  CORE_CAUSES,
  mergeCoreCauses,
};
