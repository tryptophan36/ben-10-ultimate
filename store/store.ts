import { configureStore } from "@reduxjs/toolkit";
import combatReducer from "@/store/slices/combatSlice";
import gameReducer from "@/store/slices/gameSlice";

export const store = configureStore({
  reducer: {
    game: gameReducer,
    combat: combatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
