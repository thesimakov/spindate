import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const gifts = [
    {
      id: "gift_seed_rose",
      name: "Роза",
      price: 10,
      animation: JSON.stringify({ type: "lottie", url: "https://example.com/rose.json" }),
    },
    {
      id: "gift_seed_ring",
      name: "Кольцо",
      price: 100,
      animation: JSON.stringify({ type: "lottie", url: "https://example.com/ring.json" }),
    },
  ]
  for (const g of gifts) {
    await prisma.giftCatalog.upsert({
      where: { id: g.id },
      create: g,
      update: { name: g.name, price: g.price, animation: g.animation },
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
