const fixed = [
  // Janvier : Nouvel an
  [1],
  // Février
  [],
  // Mars
  [],
  // Avril
  [],
  // Mai : Fête du travail, 8 mai 1945
  [1, 8],
  // Juin
  [],
  // Juillet : Fête nationale
  [14],
  // Août : Assomption
  [15],
  // Septembre
  [],
  // Octobre
  [],
  // Novembre : La Toussaint, Armistice
  [1, 11],
  // Decembre : Noël
  [25],
];

// Pâques, Lundi de Pâques, Ascension, Pentecôte, Lundi de Pentecôte
const easterOffseted = [0, 1, 39, 49, 50];


module.exports = {
  fixed,
  easterOffseted,
  regions: [
    // Alsace-Moselle
    [
      ['54', '55', '57', '67', '68', '88', '90'],
      {
        fixed: {
          // Saint Etienne
          12: [26]
        },
        // Vendredi Saint
        easterOffseted: [-2]
      }
    ],
    // Réunion
    [
      ['974'],
      {
        fixed: {
          // Abolition de l'esclavage
          12: [20]
        }
      }
    ],
  ]
};
