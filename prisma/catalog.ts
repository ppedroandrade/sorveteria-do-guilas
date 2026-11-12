/**
 * Catálogo inicial fornecido pelo proprietário.
 * Os nomes reais dos tamanhos ainda não foram informados — por isso "Tamanho 1" e
 * "Tamanho 2" (renomeáveis em Configurações → Apresentações).
 * As categorias são uma sugestão inicial e podem ser alteradas em cada produto.
 */
export const PRESENTATIONS = [
  { key: "t1", name: "Tamanho 1", sortOrder: 1 },
  { key: "t2", name: "Tamanho 2", sortOrder: 2 },
] as const;

export const CATEGORIES = [
  { name: "Tradicionais", sortOrder: 1 },
  { name: "Especiais", sortOrder: 2 },
  { name: "Frutados", sortOrder: 3 },
  { name: "Veganos", sortOrder: 4 },
  { name: "Edições limitadas", sortOrder: 5 },
] as const;

type CategoryName = (typeof CATEGORIES)[number]["name"];

export const FLAVORS: { name: string; price1: number; price2: number; vegan: boolean; category: CategoryName }[] = [
  { name: "Doce de leite", price1: 4500, price2: 8500, vegan: false, category: "Tradicionais" },
  { name: "Pistache", price1: 5400, price2: 10000, vegan: false, category: "Especiais" },
  { name: "Café bianco com chocolate", price1: 4500, price2: 8500, vegan: false, category: "Especiais" },
  { name: "Café bianco com caramelo", price1: 4500, price2: 8500, vegan: false, category: "Especiais" },
  { name: "Iogurte com frutas vermelhas", price1: 4500, price2: 8500, vegan: false, category: "Frutados" },
  { name: "Iogurte com frutas amarelas", price1: 4500, price2: 8500, vegan: false, category: "Frutados" },
  { name: "Cheesecake com frutas vermelhas", price1: 4500, price2: 8500, vegan: false, category: "Especiais" },
  { name: "Cheesecake com frutas amarelas", price1: 4500, price2: 8500, vegan: false, category: "Especiais" },
  { name: "Chocolate branco assado com missô", price1: 5000, price2: 9500, vegan: false, category: "Especiais" },
  { name: "Milho", price1: 4200, price2: 8000, vegan: false, category: "Tradicionais" },
  { name: "Baunilha", price1: 5400, price2: 10000, vegan: false, category: "Tradicionais" },
  { name: "Pudim", price1: 4500, price2: 8500, vegan: false, category: "Tradicionais" },
  { name: "Morango com geleia de frutas vermelhas", price1: 4500, price2: 8500, vegan: true, category: "Veganos" },
  { name: "Manga com caramelo de maracujá", price1: 4500, price2: 8500, vegan: true, category: "Veganos" },
];
