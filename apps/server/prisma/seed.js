"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const hash = await bcryptjs_1.default.hash('password', 10);
    const user = await prisma.user.create({
        data: {
            email: 'demo@example.com',
            password: hash,
            name: 'Demo User',
        },
    });
    const deck = await prisma.deck.create({
        data: {
            name: 'Spanish Basics',
            description: 'Basic Spanish vocabulary',
            userId: user.id,
            cards: {
                create: [
                    { front: 'Hello', back: 'Hola', userId: user.id },
                    { front: 'Goodbye', back: 'Adiós', userId: user.id },
                    { front: 'Thank you', back: 'Gracias', userId: user.id },
                ],
            },
        },
    });
    console.log(`Created demo user ${user.email} with deck ${deck.name}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
