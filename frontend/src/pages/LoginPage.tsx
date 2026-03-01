import React from 'react';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useLoginMutation } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { getApiMessage, getLaravelValidationErrors } from '../lib/errors';

const schema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const nav = useNavigate();
  const { isAuthenticated } = useAuth();
  const loginMutation = useLoginMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (isAuthenticated) nav('/', { replace: true });
  }, [isAuthenticated, nav]);

  const onSubmit = async (values: FormValues) => {
    try {
      await loginMutation.mutateAsync(values);
      nav('/', { replace: true });
    } catch (err) {
      const validation = getLaravelValidationErrors(err);
      if (validation) {
        Object.entries(validation).forEach(([field, msgs]) => {
          if (field === 'email' || field === 'password') {
            setError(field as 'email' | 'password', { message: msgs?.[0] ?? 'Invalid value.' });
          }
        });
        const rootMsg = validation.email?.[0] ?? validation.password?.[0];
        if (rootMsg) setError('root', { message: rootMsg });
        return;
      }
      setError('root', { message: getApiMessage(err, 'Login failed.') });
    }
  };

  return (
    <Container
      maxWidth={false}
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        backgroundImage:
          'radial-gradient(circle at 12% 8%, rgba(15,118,110,0.15), transparent 24%), radial-gradient(circle at 88% 90%, rgba(245,158,11,0.15), transparent 24%)',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.2 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
              <LockOutlinedIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.1em' }}>
                MAD VAPERS
              </Typography>
              <Typography variant="h5">Sign in</Typography>
            </Box>
          </Stack>

          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Access inventory, purchasing, transfers, and stock controls.
          </Typography>

          {errors.root?.message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.root.message}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="Email"
              margin="normal"
              fullWidth
              autoFocus
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />

            <TextField
              label="Password"
              margin="normal"
              fullWidth
              type="password"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
