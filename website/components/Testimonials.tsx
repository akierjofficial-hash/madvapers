"use client";

import useScrollReveal from "@/hooks/useScrollReveal";
import { cn } from "@/lib/cn";
import { PublicReview, submitPublicReview } from "@/lib/publicReviews";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";

type VariantOption = {
  id: number;
  label: string;
};

type ReviewFormState = {
  customerName: string;
  customerHandle: string;
  rating: number;
  title: string;
  comment: string;
  productVariantId: string;
};

interface TestimonialsProps {
  initialReviews: PublicReview[];
  variantOptions: VariantOption[];
}

interface TestiCardProps {
  review: PublicReview;
  delayClass?: string;
}

const delayClasses = ["delay-1", "delay-2", "delay-3", "delay-4", "delay-5", "delay-6"] as const;
const avatarGradients = [
  "linear-gradient(135deg, #00539a, #0099FF)",
  "linear-gradient(135deg, #4a2000, #FF6B00)",
  "linear-gradient(135deg, #001830, #0099FF)",
  "linear-gradient(135deg, #2f1320, #FFD500)",
] as const;

function getDelayClass(index: number): string {
  return delayClasses[index % delayClasses.length];
}

function getAvatarGradient(id: number): string {
  const index = Math.abs(id) % avatarGradients.length;
  return avatarGradients[index];
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return "MD";
  }
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return initials.join("") || "MD";
}

function normalizeHandle(handle: string | null): string {
  if (!handle || !handle.trim()) {
    return "Guest";
  }
  const value = handle.trim();
  return value.startsWith("@") ? value : `@${value}`;
}

function formatReviewDate(value: string | null): string {
  if (!value) {
    return "Recently";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function getReviewContext(review: PublicReview): string | null {
  if (review.variant?.variant_name && review.product?.name) {
    return `${review.product.name} - ${review.variant.variant_name}`;
  }
  if (review.product?.name) {
    return review.product.name;
  }
  return null;
}

function TestiCard({ review, delayClass }: TestiCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isVisible = useScrollReveal(ref);
  const context = getReviewContext(review);

  return (
    <article
      ref={ref}
      className={cn(
        "testi-card reveal relative border border-white/10 bg-dark2 p-9 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-blue/25 hover:shadow-2xl",
        isVisible && "visible",
        delayClass,
      )}
    >
      <span className="pointer-events-none absolute right-6 top-6 font-display text-[80px] leading-none text-brand-blue/10">"</span>

      <div className="mb-5 flex gap-1 text-sm">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={`${review.id}-star-${index}`} className={index < review.rating ? "text-brand-yellow" : "text-white/20"}>
            ★
          </span>
        ))}
      </div>

      {review.title ? <h3 className="mb-2 font-heading text-base uppercase tracking-[0.08em] text-white">{review.title}</h3> : null}
      <p className="mb-6 text-sm italic leading-8 text-[#B8BFCE]">{review.comment}</p>
      {context ? <p className="mb-4 text-xs uppercase tracking-[0.12em] text-brand-blue">{context}</p> : null}

      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full font-heading text-base font-bold text-white"
          style={{ background: getAvatarGradient(review.id) }}
        >
          {getInitials(review.customer_name)}
        </span>
        <span>
          <strong className="block font-heading text-sm font-bold tracking-[0.06em]">{review.customer_name}</strong>
          <small className="font-heading text-xs tracking-[0.08em] text-brand-blue">
            {normalizeHandle(review.customer_handle)} · {formatReviewDate(review.created_at)}
          </small>
          {review.is_verified_purchase ? (
            <small className="block font-heading text-[10px] uppercase tracking-[0.14em] text-brand-yellow">Verified purchase</small>
          ) : null}
        </span>
      </div>
    </article>
  );
}

const defaultFormState: ReviewFormState = {
  customerName: "",
  customerHandle: "",
  rating: 5,
  title: "",
  comment: "",
  productVariantId: "",
};

export default function Testimonials({ initialReviews, variantOptions }: TestimonialsProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const statsRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const headerVisible = useScrollReveal(headerRef);
  const statsVisible = useScrollReveal(statsRef);
  const formVisible = useScrollReveal(formRef);

  const [reviews, setReviews] = useState<PublicReview[]>(initialReviews);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [form, setForm] = useState<ReviewFormState>(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const summary = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return { average: 0, total: 0, recommendRate: 0 };
    }

    const ratingTotal = reviews.reduce((sum, item) => sum + Math.max(1, Math.min(5, item.rating)), 0);
    const recommendCount = reviews.reduce((sum, item) => (item.rating >= 4 ? sum + 1 : sum), 0);

    return {
      average: ratingTotal / total,
      total,
      recommendRate: Math.round((recommendCount / total) * 100),
    };
  }, [reviews]);

  const displayedReviews = useMemo(() => (showAllReviews ? reviews : reviews.slice(0, 3)), [reviews, showAllReviews]);

  const onFieldChange =
    (field: keyof ReviewFormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.currentTarget.value;
      if (field === "rating") {
        const parsed = Number(value);
        setForm((prev) => ({ ...prev, rating: Number.isFinite(parsed) ? parsed : prev.rating }));
        return;
      }
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const customerName = form.customerName.trim();
    const comment = form.comment.trim();
    const title = form.title.trim();
    const customerHandle = form.customerHandle.trim();

    if (customerName.length < 2) {
      setFeedback({ type: "error", message: "Please enter your name." });
      return;
    }
    if (comment.length < 10) {
      setFeedback({ type: "error", message: "Please write at least 10 characters for your review." });
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await submitPublicReview({
        customerName,
        customerHandle: customerHandle || null,
        rating: form.rating,
        title: title || null,
        comment,
        productVariantId: form.productVariantId ? Number(form.productVariantId) : null,
      });

      setReviews((prev) => [created, ...prev.filter((item) => item.id !== created.id)].slice(0, 60));
      setFeedback({ type: "success", message: "Thanks. Your review is now live." });
      setForm((prev) => ({
        ...defaultFormState,
        customerName: prev.customerName,
        customerHandle: prev.customerHandle,
      }));
      setShowAllReviews(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to submit your review right now.";
      setFeedback({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="testimonials" className="bg-dark2 px-5 py-20 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[1400px]">
        <div ref={headerRef} className={cn("reveal mb-12 text-center", headerVisible && "visible")}>
          <p className="mb-3 font-heading text-[11px] uppercase tracking-[0.34em] text-brand-blue">Reviews</p>
          <h2 className="font-display text-[clamp(48px,6vw,80px)] leading-[0.95] tracking-[0.04em]">
            THE
            <br />
            <span className="text-brand-blue">VERDICT</span>
          </h2>
        </div>

        <div
          ref={formRef}
          className={cn(
            "reveal mb-14 grid gap-6 border border-white/10 bg-dark p-6 lg:grid-cols-[0.9fr_1.1fr]",
            formVisible && "visible",
          )}
        >
          <div>
            <p className="mb-2 font-heading text-[11px] uppercase tracking-[0.24em] text-brand-blue">Share Your Experience</p>
            <h3 className="font-display text-[clamp(28px,4vw,46px)] leading-[0.92] tracking-[0.03em]">
              WRITE A
              <br />
              <span className="text-brand-yellow">REVIEW</span>
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#B8BFCE]">
              Help other customers choose the right device. Mention the variant and your rating after real usage.
            </p>
          </div>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block font-heading text-xs uppercase tracking-[0.14em] text-[#B8BFCE]">Name</span>
              <input
                type="text"
                value={form.customerName}
                onChange={onFieldChange("customerName")}
                maxLength={120}
                required
                className="w-full border border-white/15 bg-dark2 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-blue"
                placeholder="Your name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-heading text-xs uppercase tracking-[0.14em] text-[#B8BFCE]">Handle (optional)</span>
              <input
                type="text"
                value={form.customerHandle}
                onChange={onFieldChange("customerHandle")}
                maxLength={120}
                className="w-full border border-white/15 bg-dark2 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-blue"
                placeholder="@username"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-heading text-xs uppercase tracking-[0.14em] text-[#B8BFCE]">Rating</span>
              <select
                value={String(form.rating)}
                onChange={onFieldChange("rating")}
                className="w-full border border-white/15 bg-dark2 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-blue"
              >
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Very Good</option>
                <option value="3">3 - Good</option>
                <option value="2">2 - Fair</option>
                <option value="1">1 - Poor</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block font-heading text-xs uppercase tracking-[0.14em] text-[#B8BFCE]">Variant (optional)</span>
              <select
                value={form.productVariantId}
                onChange={onFieldChange("productVariantId")}
                className="w-full border border-white/15 bg-dark2 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-blue"
              >
                <option value="">General review</option>
                {variantOptions.map((option) => (
                  <option key={option.id} value={String(option.id)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block font-heading text-xs uppercase tracking-[0.14em] text-[#B8BFCE]">Title (optional)</span>
              <input
                type="text"
                value={form.title}
                onChange={onFieldChange("title")}
                maxLength={180}
                className="w-full border border-white/15 bg-dark2 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-blue"
                placeholder="Short headline for your review"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block font-heading text-xs uppercase tracking-[0.14em] text-[#B8BFCE]">Review</span>
              <textarea
                value={form.comment}
                onChange={onFieldChange("comment")}
                minLength={10}
                maxLength={1500}
                required
                rows={4}
                className="w-full resize-y border border-white/15 bg-dark2 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-blue"
                placeholder="Tell customers what you liked about the flavor, draw, and overall quality."
              />
            </label>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "btn-clip border border-brand-blue bg-brand-blue px-6 py-3 font-heading text-xs uppercase tracking-[0.2em] text-black transition-all duration-300",
                  isSubmitting ? "cursor-not-allowed opacity-60" : "hover:bg-brand-blue/90 hover:shadow-[0_0_24px_rgba(0,153,255,0.45)]",
                )}
              >
                {isSubmitting ? "Submitting..." : "Submit Review"}
              </button>
              {feedback ? (
                <p className={cn("mt-3 text-xs uppercase tracking-[0.1em]", feedback.type === "success" ? "text-brand-yellow" : "text-red-400")}>
                  {feedback.message}
                </p>
              ) : null}
            </div>
          </form>
        </div>

        {displayedReviews.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {displayedReviews.map((review, index) => (
                <TestiCard key={review.id} review={review} delayClass={getDelayClass(index)} />
              ))}
            </div>
            {reviews.length > 3 ? (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllReviews((prev) => !prev)}
                  className="btn-clip border border-brand-blue bg-transparent px-6 py-3 font-heading text-xs uppercase tracking-[0.2em] text-brand-blue transition-all duration-300 hover:bg-brand-blue hover:text-black hover:shadow-[0_0_24px_rgba(0,153,255,0.45)]"
                >
                  {showAllReviews ? "See Less" : "See All Reviews"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="border border-white/10 bg-dark p-6 text-center">
            <p className="font-heading text-xs uppercase tracking-[0.16em] text-brand-blue">No reviews yet</p>
            <p className="mt-2 text-sm text-[#B8BFCE]">Be the first to share your experience.</p>
          </div>
        )}

        <div
          ref={statsRef}
          className={cn(
            "reveal mt-16 grid gap-8 border-t border-white/10 pt-16 text-center sm:grid-cols-3",
            statsVisible && "visible",
          )}
        >
          <div>
            <p className="font-display text-7xl leading-none text-brand-yellow">{summary.average.toFixed(1)}</p>
            <p className="mt-2 font-heading text-[11px] uppercase tracking-[0.26em] text-[#8890A4]">Average Rating</p>
          </div>
          <div>
            <p className="font-display text-7xl leading-none text-brand-blue">{summary.total}</p>
            <p className="mt-2 font-heading text-[11px] uppercase tracking-[0.26em] text-[#8890A4]">Published Reviews</p>
          </div>
          <div>
            <p className="font-display text-7xl leading-none text-white">{summary.recommendRate}%</p>
            <p className="mt-2 font-heading text-[11px] uppercase tracking-[0.26em] text-[#8890A4]">Would Recommend</p>
          </div>
        </div>
      </div>
    </section>
  );
}
