#!/usr/bin/env python

import boto3
import configparser
import mimetypes
import os


def push_files(config_file, src_dir_path, bucket_name):
    config = configparser.ConfigParser()
    config.read(config_file)
    s3 = boto3.client('s3', aws_access_key_id=config.get('boto', 'KeyID'),
                      aws_secret_access_key=config.get('boto', 'SecretKey'))

    for root, dirs, files in os.walk(src_dir_path):
        for entry in files:
            full_path = os.path.join(root, entry)
            rel_path = full_path[len(src_dir_path)+1:]
            print(full_path, rel_path)
            s3.upload_file(full_path, bucket_name, rel_path, ExtraArgs={
                'ContentType': mimetypes.guess_type(full_path)[0]
            })


if __name__ == '__main__':
    our_dir = os.path.dirname(os.path.abspath(__file__))
    push_files(os.path.join(our_dir, 'deploy.ini'), os.path.join(our_dir, 'content'), 'houses.jampy.org')
