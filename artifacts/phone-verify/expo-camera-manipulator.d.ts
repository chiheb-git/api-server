declare module "expo-camera" {
  import * as React from "react";
  import type { ViewProps } from "react-native";

  export interface CameraPermissionResponse {
    granted: boolean;
  }

  export interface CameraCapturedPicture {
    uri: string;
  }

  export interface CameraViewRef {
    takePictureAsync(options?: { quality?: number }): Promise<CameraCapturedPicture>;
  }

  export const CameraView: React.ForwardRefExoticComponent<
    ViewProps & { facing?: "front" | "back" } & React.RefAttributes<CameraViewRef>
  >;

  export function useCameraPermissions(): [
    CameraPermissionResponse | null,
    () => Promise<CameraPermissionResponse>,
  ];
}

declare module "expo-image-manipulator" {
  export enum SaveFormat {
    JPEG = "jpeg",
    PNG = "png",
    WEBP = "webp",
  }

  export interface ImageResult {
    uri: string;
    base64?: string;
  }

  export function manipulateAsync(
    uri: string,
    actions: Array<{ resize?: { width?: number; height?: number } }>,
    options?: { compress?: number; format?: SaveFormat; base64?: boolean },
  ): Promise<ImageResult>;
}
