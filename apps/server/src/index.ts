import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import deckRoutes from './routes/decks';
import cardRoutes from './routes/cards';
import reviewRoutes from './routes/reviews';
import syncRoutes from './routes/sync';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/decks', deckRoutes);
app.use('/cards', cardRoutes);
app.use('/reviews', reviewRoutes);
app.use('/sync', syncRoutes);

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
