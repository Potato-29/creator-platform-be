import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import sharp from 'sharp';
import type { File as MulterFile } from 'multer';

@Injectable()
export class SpacesService {
  private spacesEndpoint: AWS.S3;

  constructor(private configService: ConfigService) {
    // Initialize DigitalOcean Spaces client
    this.spacesEndpoint = new AWS.S3({
      endpoint: this.configService.get('server.bucket.spacesEndpoint'),
      accessKeyId: this.configService.get('server.bucket.spacesKey'),
      secretAccessKey: this.configService.get('server.bucket.spacesSecret'),
      region: this.configService.get('server.bucket.spacesRegion'),
      s3ForcePathStyle: true, // Use path-style URLs instead
      signatureVersion: 'v4',
      sslEnabled: true,
      s3BucketEndpoint: false,
    });
  }

  /**
   * Upload a single file to DigitalOcean Spaces
   */
  async uploadFile(
    file: MulterFile,
    folderName: string,
    options?: {
      resize?: { width: number; height: number };
      quality?: number;
    }
  ): Promise<string> {
    try {
      let buffer = file.buffer;
      let contentType = file.mimetype;
      // Process image if resize options are provided
      if (options?.resize && file.mimetype.startsWith('image/')) {
        buffer = await sharp(file.buffer)
          .resize(options.resize.width, options.resize.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: options.quality || 80 })
          .toBuffer();
        contentType = 'image/jpeg';
      }
      // Generate unique filename
      // const fileExtension = this.getFileExtension(file.originalname);
      // console.log(fileExtension)
      const fileName = `content/${folderName}`;

      const uploadParams = {
        Bucket: this.configService.get('server.bucket.spacesBucket'),
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read', // Make files publicly accessible
      };
      const result = await this.spacesEndpoint.upload(uploadParams).promise();
      return result.Location;
    } catch (error) {
      throw new BadRequestException(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: MulterFile[],
    folderName: string,
    options?: {
      resize?: { width: number; height: number };
      quality?: number;
    }
  ): Promise<string[]> {
    const uploadPromises = files.map(file => 
      this.uploadFile(file, folderName, options)
    );
    return Promise.all(uploadPromises);
  }

  /**
   * Delete a file from Spaces
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const key = this.extractKeyFromUrl(fileUrl);
      const deleteParams = {
        Bucket: this.configService.get('server.bucket.spacesBucket'),
        Key: key,
      };

      await this.spacesEndpoint.deleteObject(deleteParams).promise();
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw error for delete operations to prevent blocking other operations
    }
  }

  /**
   * Validate file type and size
   */
  validateFile(file: MulterFile, type: 'image' | 'video'): void {
    const maxSizes = {
      image: 5 * 1024 * 1024, // 5MB
      video: 100 * 1024 * 1024, // 100MB
    };

    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/webp'],
      video: ['video/mp4', 'video/mpeg', 'video/x-msvideo'],
    };

    if (!allowedTypes[type].includes(file.mimetype)) {
      throw new BadRequestException(`Invalid ${type} format`);
    }

    if (file.size > maxSizes[type]) {
      throw new BadRequestException(
        `${type} size exceeds limit of ${maxSizes[type] / (1024 * 1024)}MB`
      );
    }
  }

  private getFileExtension(filename: string): string {
    return filename.substring(filename.lastIndexOf('.'));
  }

  private extractKeyFromUrl(url: string): string {
    const bucketUrl = `https://${this.configService.get('server.bucket.spacesEndpoint')}/`;
    return url.replace(bucketUrl, '');
  }
}