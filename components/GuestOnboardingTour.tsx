/**
 * GuestOnboardingTour Component
 *
 * Provides an interactive tour for guest users to understand the workflow.
 * Uses Ant Design's Tour component to guide users through the main features.
 *
 * Features:
 * - Auto-performs actions when user clicks Next (e.g., opens GenerateMoreModal)
 * - Floating restart button to reopen the tour
 * - First 4 steps only (subsequent steps require manual user interaction)
 */

import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Tour, TourProps, ConfigProvider } from 'antd';
import { useDispatch } from 'react-redux';
import { useGuest } from '@/contexts/GuestContext';
import { Color } from '@/types';
import { setSourceImage, setIsGenerateModalOpen, setSelectedColor } from '@/stores/taskStore';
import { setSelectedOriginalImageIds } from '@/stores/imageStore';
import { getDemoImages, getDefaultDemoImageId } from '@/constants/demoImages';
import { PRESET_COLOR } from '@/constants/constants';
import { GenerateMoreModalRef } from '@/components/modal/GenerateMoreModal';

interface GuestOnboardingTourProps {
  // Refs are optional since we use data-tour selectors for most targets
  designGoalRef?: React.RefObject<HTMLElement>;
  originalGalleryRef?: React.RefObject<HTMLElement>;
  colorSelectRef?: React.RefObject<HTMLElement>;
  generateButtonRef?: React.RefObject<HTMLElement>;
  generateModalRef: React.RefObject<GenerateMoreModalRef | null>;
}

export interface GuestOnboardingTourRef {
  openTour: () => void;
  closeTour: () => void;
}

const TOUR_STORAGE_KEY = 'guest-tour-completed';

const GuestOnboardingTour = forwardRef<GuestOnboardingTourRef, GuestOnboardingTourProps>(
  ({ designGoalRef, originalGalleryRef, colorSelectRef, generateButtonRef, generateModalRef }, ref) => {
    const { isGuestMode } = useGuest();
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [tourSelectedColor, setTourSelectedColor] = useState<Color | null>(null);

    // When the tour opens, pick a random preset color and set it as the selected color
    useEffect(() => {
      if (open) {
        const random = PRESET_COLOR[Math.floor(Math.random() * PRESET_COLOR.length)];
        setTourSelectedColor(random);
        dispatch(setSelectedColor(random));
      }
    }, [open, dispatch]);

    // We no longer auto-start the tour. It is triggered manually via GreetingModal or Header.
    useEffect(() => {
      // Initialize state or other logic if needed, but don't setOpen(true) here.
    }, [isGuestMode]);

    // Handle step change - perform auto-actions
    const handleStepChange = useCallback(
      (newStep: number) => {
        // When moving FROM step 3 (index 3) to step 4, auto-open the GenerateMoreModal
        if (currentStep === 3 && newStep === 4) {
          // Get the first demo image and set it as source
          const demoImages = getDemoImages();
          const defaultImageId = getDefaultDemoImageId();
          const sourceImage = demoImages.find((img) => img.id === defaultImageId);

          if (sourceImage) {
            // Set source image and open modal
            dispatch(setSourceImage(sourceImage));
            dispatch(setIsGenerateModalOpen(true));
          }
        }

        setCurrentStep(newStep);
      },
      [currentStep, dispatch]
    );

    const handleClose = () => {
      setOpen(false);
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    };

    const handleFinish = () => {
      // If finishing on step 6 (the Generate step), trigger the generate button
      if (currentStep === 5) {
        // Step 6 is index 5
        generateModalRef.current?.triggerGenerate();
      }
      handleClose();
    };

    const openTour = useCallback(() => {
      setCurrentStep(0);
      setOpen(true);
    }, []);

    // Expose openTour and closeTour to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        openTour,
        closeTour: handleClose,
      }),
      [openTour]
    );

    // Define tour steps (only first 4 steps are guided, rest require manual interaction)
    const steps: TourProps['steps'] = [
      {
        title: 'Step 1: Choose Design Goal',
        description: (
          <div>
            <p>
              <strong>Recolor Wall</strong> is already selected for you.
            </p>
            <p className="text-gray-200 text-xs mt-2">
              Note: Only this design goal is available in guest mode.
            </p>
          </div>
        ),
        target: () =>
          designGoalRef?.current ||
          (document.querySelector('[data-tour="design-goal"]') as HTMLElement),
        placement: 'right',
      },
      {
        title: 'Step 2: Select Original Image',
        description: (
          <div>
            <p>
              A demo image has been pre-selected from the <strong>Original Images</strong> section.
            </p>
          </div>
        ),
        target: () =>
          originalGalleryRef?.current ||
          (document.querySelector('[data-tour="original-gallery"]') as HTMLElement),
        placement: 'top',
      },
      {
        title: 'Step 3: Select Color',
        description: (
          <div>
            <p>
              A default color <strong>{tourSelectedColor?.name ?? 'a preset color'}</strong>
              {tourSelectedColor && (
                <span
                  className="inline-block w-3 h-3 rounded-sm ml-2 align-middle"
                  style={{ backgroundColor: tourSelectedColor.hex }}
                  aria-hidden="true"
                />
              )}{' '}
              has been pre-selected for you.
            </p>
            <p className="text-gray-200 text-xs mt-2">
              Feel free to pick a different color if you prefer.
            </p>
          </div>
        ),
        target: () =>
          colorSelectRef?.current ||
          (document.querySelector('[data-tour="color-select"]') as HTMLElement),
        placement: 'top',
      },
      {
        title: 'Step 4: Open Generate Window',
        description: (
          <div>
            <p>
              Click <strong>Next</strong> to automatically open the Generate window.
            </p>
          </div>
        ),
        target: () =>
          generateButtonRef?.current ||
          (document.querySelector('[data-tour="generate-button"]') as HTMLElement),
        placement: 'left',
      },
      {
        title: 'Step 5: Enter Custom Prompt (Optional)',
        description: (
          <div>
            <p>
              You can enter additional instructions here, or leave it empty to use the default
              prompt.
            </p>
            <p className="text-gray-200 text-xs mt-2">
              Example: "Apply only to the accent wall behind the sofa"
            </p>
          </div>
        ),
        target: () => document.querySelector('[data-tour="custom-prompt-input"]') as HTMLElement,
        placement: 'left',
      },
      {
        title: 'Step 6: Start Generation',
        description: (
          <div>
            <p>
              Click the <strong>Generate</strong> button to start AI processing.
            </p>
            <p className="text-gray-402 text-xs mt-2">This may take 10-20 seconds.</p>
          </div>
        ),
        target: () => document.querySelector('[data-tour="modal-generate-button"]') as HTMLElement,
        placement: 'top',
      },
    ];

    if (!isGuestMode) {
      return null;
    }

    return (
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#6366f1', // Indigo 500
          },
        }}
      >
        {/* Main Tour */}
        <Tour
          open={open}
          steps={steps}
          current={currentStep}
          onChange={handleStepChange}
          onClose={handleClose}
          onFinish={handleFinish}
          mask={{
            style: {
              boxShadow: 'inset 0 0 15px #333',
            },
            color: 'rgba(0, 0, 0, 0.6)',
          }}
          type="primary"
        />
      </ConfigProvider>
    );
  }
);

GuestOnboardingTour.displayName = 'GuestOnboardingTour';

export default GuestOnboardingTour;
