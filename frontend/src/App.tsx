import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";

import AdminSurveysListPage from "./pages/AdminSurveysListPage";
import AdminSurveyEditorPage from "./pages/AdminSurveyEditorPage";
import PublicSurveyRunPage from "./pages/PublicSurveyRunPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Survey Service (MVP)
          </Typography>

          <Button color="inherit" component={Link} to="/admin/surveys">
            Admin
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ py: 3 }}>
        <Container maxWidth="lg">
          <Routes>
            <Route path="/" element={<Navigate to="/admin/surveys" replace />} />

            <Route path="/admin/surveys" element={<AdminSurveysListPage />} />
            <Route path="/admin/surveys/:id" element={<AdminSurveyEditorPage />} />

            {/* Public runner */}
            <Route path="/s/:surveyId" element={<PublicSurveyRunPage />} />

            <Route path="*" element={<div>Not found</div>} />
          </Routes>
        </Container>
      </Box>
    </BrowserRouter>
  );
}