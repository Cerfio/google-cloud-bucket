/**
 * Copyright (c) 2018, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/


// Uploading data: https://cloud.google.com/storage/docs/json_api/v1/how-tos/upload
// Best practices: https://cloud.google.com/storage/docs/json_api/v1/how-tos/performance
// Object versioning: https://cloud.google.com/storage/docs/object-versioning

const { fetch, urlHelper, obj: { merge } } = require('./utils')

const BUCKET_UPLOAD_URL = (bucket, fileName) => `https://www.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(fileName)}`
const BUCKET_URL = bucket => `https://www.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`
const BUCKET_FILE_URL = (bucket, filepath) => `${BUCKET_URL(bucket)}/o${ filepath ? `${filepath ? `/${encodeURIComponent(filepath)}` : ''}` : ''}`

const _validateRequiredParams = (params={}) => Object.keys(params).forEach(p => {
	if (!params[p])
		throw new Error(`Parameter '${p}' is required.`)
})

const putObject = (object, filePath, token, options={}) => Promise.resolve(null).then(() => {
	_validateRequiredParams({ object, filePath, token })
	const payload = typeof(object) == 'string' ? object : JSON.stringify(object || {})
	const [ bucket, ...names ] = filePath.split('/')

	const { contentType } = urlHelper.getInfo(filePath)

	let headers = merge(options.headers || {}, { 
		'Content-Length': payload.length,
		Authorization: `Bearer ${token}`
	})

	if (!headers['Content-Type'])
		headers['Content-Type'] = contentType || 'application/json'

	return fetch.post(BUCKET_UPLOAD_URL(bucket, names.join('/')), headers, payload)
})

const getBucket = (bucket, token) => Promise.resolve(null).then(() => {
	_validateRequiredParams({ bucket, token })

	return fetch.get(BUCKET_URL(bucket), {
		Accept: 'application/json',
		Authorization: `Bearer ${token}`
	})
})

const getBucketFile = (bucket, filepath, token) => Promise.resolve(null).then(() => {
	_validateRequiredParams({ bucket, filepath, token })

	const { contentType } = urlHelper.getInfo(filepath)

	return fetch.get(`${BUCKET_FILE_URL(bucket, filepath)}?alt=media`, {
		Accept: contentType || 'application/json',
		Authorization: `Bearer ${token}`
	}).then(({ status, data }) => {
		if (status < 400)
			return { status, data }

		let e = new Error(status == 404 ? 'Object not found' : status == 401 ? 'Access denied' : 'Internal Server Error')
		e.code = status
		e.data = data
		throw e
	})
})

const makePublic = (bucket, filepath, token) => Promise.resolve(null).then(() => {
	_validateRequiredParams({ bucket, token })

	if (filepath) {
		const { ext } = urlHelper.getInfo(filepath)
		if (!ext)
			throw new Error('Bucket\'s folder cannot be made public. Only buckets or existing objects can be made public.')

		const payload = JSON.stringify({
			entity: 'allUsers',
			role: 'READER'
		})
		return fetch.post(`${BUCKET_FILE_URL(bucket, filepath)}/acl`, {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}, payload).then(({ status, data }) => {
			if (status < 400) {
				data = data || {}
				data.uri = `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${filepath}`
				return { status, data }
			}
			let e = new Error(status == 404 ? 'Object not found' : status == 401 ? 'Access denied' : 'Internal Server Error')
			e.code = status
			e.data = data
			throw e
		})
	} else {
		const payload = JSON.stringify({
			bindings:[{
				role: 'roles/storage.objectViewer',
				members: ['allUsers']
			}]
		})
		return fetch.put(`${BUCKET_URL(bucket)}/iam`, {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		}, payload).then(({ status, data }) => {
			if (status < 400) {
				data = data || {}
				data.uri = `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${filepath}`
				return { status, data }
			}

			console.log(JSON.stringify(data, null, ' '))

			let e = new Error(status == 404 ? 'Object not found' : status == 401 ? 'Access denied' : 'Internal Server Error')
			e.code = status
			e.data = data
			throw e
		})
	}
})

const updateConfig = (bucket, config={}, token) => Promise.resolve(null).then(() => {
	_validateRequiredParams({ bucket, token })
	if (!Object.keys(config).some(x => x))
		return { status: 200, data: { message: 'Empty config. Nothing to update.' } }

	const payload = JSON.stringify(config)

	return fetch.patch(`${BUCKET_URL(bucket)}`, {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`
	}, payload).then(({ status, data }) => {
		if (status < 400) {
			data = data || {}
			data.uri = `https://storage.googleapis.com/${encodeURIComponent(bucket)}`
			return { status, data }
		}

		let e = new Error(status == 404 ? 'Object not found' : status == 401 ? 'Access denied' : 'Internal Server Error')
		e.code = status
		e.data = data
		throw e
	})
})

module.exports = {
	insert: putObject,
	'get': getBucketFile,
	makePublic,
	config: {
		'get': getBucket,
		update: updateConfig
	}
}




