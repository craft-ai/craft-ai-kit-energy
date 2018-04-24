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
    // Moselle, Bas-Rhin, Haut-Rhin
    [
      ['57', '67', '68'],
      {
        fixed: {
          // Saint Etienne
          12: [26]
        },
        // Vendredi Saint
        easterOffseted: [-2]
      }
    ],
    // Guadeloupe
    [
      ['971'],
      {
        fixed: {
          // Abolition de l'esclavage
          5: [27],
          // Fête Victor Schœlcher
          7: [21]
        },
        // Vendredi Saint
        easterOffseted: [-2]
      }
    ],
    // Martinique
    [
      ['972'],
      {
        fixed: {
          // Abolition de l'esclavage
          5: [22],
          // Fête Victor Schœlcher
          7: [21]
        },
        // Vendredi Saint
        easterOffseted: [-2]
      }
    ],
    // Guyane
    [
      ['973'],
      {
        fixed: {
          // Abolition de l'esclavage
          6: [10]
        }
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
    // Saint-Barthélemy, Saint-Martin
    [
      ['977', '978'],
      {
        fixed: {
          // Abolition de l'esclavage
          5: [27],
        }
      }
    ],
    // Wallis-et-Futuna
    [
      ['986'],
      {
        fixed: {
          // Saint-Pierre-Chanel
          4: [28],
          // Fête du Territoire
          7: [29]
        }
      }
    ],
    // Polynésie française
    [
      ['987'],
      {
        fixed: {
          // Fête de l’autonomie
          6: [29]
        },
        // Vendredi Saint
        easterOffseted: [-2]
      }
    ],
    // Nouvelle-Calédonie
    [
      ['988'],
      {
        fixed: {
          // Fête de la citoyenneté
          9: [24]
        }
      }
    ],
  ]
};
