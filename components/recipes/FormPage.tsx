import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { Recipe } from "@/lib/db/schema";
import BackLink from "./BackLink";
import { panelSx } from "./RecipeCard";
import RecipeForm from "./RecipeForm";

export default function FormPage({ title, recipe, tagOptions, logged = false }: { title: string; recipe?: Recipe; tagOptions: string[]; logged?: boolean }) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      {recipe ? <BackLink href={`/recipes/${recipe.id}`} label="Back to the recipe" /> : <BackLink />}
      <Typography variant="h3" component="h1" sx={{ mb: 2.5, fontSize: "clamp(28px, 4vw, 40px)" }}>
        {title}
      </Typography>
      <Box sx={{ ...panelSx, p: { xs: 2, md: 4 } }}>
        <RecipeForm recipe={recipe} tagOptions={tagOptions} logged={logged} />
      </Box>
    </Container>
  );
}
